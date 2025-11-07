import { GameLogger } from "../logging";
import { useDeckValidator } from "../parsing";
import { isSubset, removeElement } from "../util";

import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import { Player } from "./Player";
import { PlayerGameView } from "./PlayerGameView";
import { PlayerPokemonView } from "./PlayerPokemonView";
import type {
  Ability,
  Attack,
  CardSlot,
  CoinFlipIndicator,
  Energy,
  FossilCard,
  GameRules,
  PlayerAgent,
  PlayerGameSetup,
  PlayerStatus,
  PlayingCard,
  PokemonCard,
  PokemonStatus,
  PokemonToolCard,
  TrainerCard,
} from "./types";

export class Game {
  Agent1: PlayerAgent;
  Agent2: PlayerAgent;
  Player1: Player;
  Player2: Player;
  GameLog: GameLogger = new GameLogger();

  TurnNumber: number = 0;
  AttackingPlayer: Player;
  DefendingPlayer: Player;
  CanRetreat: boolean = true;
  CanPlaySupporter: boolean = true;
  ActiveTrainerCard?: TrainerCard;
  CurrentAttack: Attack | undefined;
  AttackingPokemon?: InPlayPokemonCard;
  UsedAbilities: Set<InPlayPokemonCard> = new Set();
  AttackDamagedPokemon: Set<InPlayPokemonCard> = new Set();
  AttackKnockedOutPokemon: Set<InPlayPokemonCard> = new Set();

  GameRules: GameRules = {
    DeckSize: 20,
    InitialHandSize: 5,
    MaxHandSize: 10,
    PrizePoints: 3,
    TurnLimit: 30,
    DelayPerAction: 0,
  };

  GameOver: boolean = false;

  endTurnResolve: (value: unknown) => void = () => {};

  constructor(agent1: PlayerAgent, agent2: PlayerAgent, rules?: Partial<GameRules>) {
    Object.assign(this.GameRules, rules);
    this.Agent1 = agent1;
    this.Agent2 = agent2;

    const deck1 = {
      Cards: agent1.Deck,
      EnergyTypes: agent1.EnergyTypes,
    };
    const deck2 = {
      Cards: agent2.Deck,
      EnergyTypes: agent2.EnergyTypes,
    };

    const { validateDeck } = useDeckValidator(this.GameRules);

    const validation1 = validateDeck(deck1);
    if (validation1 !== true) {
      throw new Error("Player 1 has an invalid deck: " + validation1);
    }
    const validation2 = validateDeck(deck2);
    if (validation2 !== true) {
      throw new Error("Player 2 has an invalid deck: " + validation2);
    }

    const name1 = agent1.Name || "Player 1";
    const name2 = agent2.Name || "Player 2";

    if (name1 === name2) {
      // Ensure both players have unique names
      agent1.Name = `${name1} (1)`;
      agent2.Name = `${name2} (2)`;
    }

    this.Player1 = new Player(name1, deck1, this);
    this.Player2 = new Player(name2, deck2, this);

    // Randomize who goes first based on a coin flip
    const players = [this.Player1, this.Player2];
    if (Math.random() >= 0.5) {
      players.reverse();
    }
    this.AttackingPlayer = players[0]!;
    this.DefendingPlayer = players[1]!;
    this.GameLog.startGame(this.AttackingPlayer, this.DefendingPlayer);

    this.AttackingPlayer.setup(this.GameRules.InitialHandSize);
    this.DefendingPlayer.setup(this.GameRules.InitialHandSize);
  }

  // Helper methods
  async delay(): Promise<void> {
    const delay = this.GameRules.DelayPerAction;
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  private viewToPokemon(
    view: PlayerPokemonView,
    validPokemon: InPlayPokemonCard[]
  ): InPlayPokemonCard {
    const pokemon = validPokemon.find((p) => view.is(p));
    if (!pokemon) throw new Error("Invalid Pokémon selected");
    return pokemon;
  }

  // Game flow methods

  /**
   * Sets up the game, then kicks off the game loop.
   */
  async start(): Promise<void> {
    const [setup1, setup2] = await Promise.all([
      this.startPlayer(this.Agent1, this.Player1),
      this.startPlayer(this.Agent2, this.Player2),
    ]);

    await this.Player1.setupPokemon(setup1);
    await this.Player2.setupPokemon(setup2);

    await this.delay();

    while (this.TurnNumber < this.GameRules.TurnLimit && !this.GameOver) {
      try {
        await this.nextTurn();
      } catch (error) {
        const outError = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error("Error during turn:", outError);
        this.GameLog.invalidGameState();
        this.GameOver = true;
        break;
      }
    }
  }

  private async startPlayer(agent: PlayerAgent, player: Player): Promise<PlayerGameSetup> {
    return await agent.setupPokemon({
      hand: player.Hand,
      firstEnergy: player.NextEnergy,
      isGoingFirst: player == this.AttackingPlayer,
    });
  }

  /**
   * The core of the game loop.
   */
  private async nextTurn(): Promise<void> {
    // Switch the attacking and defending players
    if (this.TurnNumber > 0) {
      [this.AttackingPlayer, this.DefendingPlayer] = [this.DefendingPlayer, this.AttackingPlayer];
    }
    this.TurnNumber += 1;

    // Reset turn-based flags
    this.CanRetreat = true;
    this.CanPlaySupporter = true;
    this.UsedAbilities = new Set();
    this.AttackDamagedPokemon = new Set();
    this.AttackKnockedOutPokemon = new Set();
    if (this.TurnNumber > 2) {
      for (const pokemon of this.AttackingPlayer.InPlayPokemon) {
        pokemon.ReadyToEvolve = true;
      }
    }

    // Log the turn change
    this.GameLog.nextTurn(this.TurnNumber, this.AttackingPlayer, this.DefendingPlayer);

    // Generate next energy for the attacking player
    if (this.TurnNumber > 1) {
      this.AttackingPlayer.AvailableEnergy = this.AttackingPlayer.NextEnergy;
      this.AttackingPlayer.chooseNextEnergy();
    }

    // Log the Special Conditions that will affect the Active Pokemon
    const status = this.AttackingPlayer.activeOrThrow().PrimaryCondition;
    if (status == "Asleep" || status == "Paralyzed") {
      this.GameLog.specialConditionEffective(this.AttackingPlayer);
    }

    // Draw a card into the attacking player's hand
    this.AttackingPlayer.drawCards(1);

    // Execute the player's turn
    try {
      await new Promise((resolve, reject) => {
        // Any attack and some other effects will end the turn immediately
        this.endTurnResolve = resolve;

        // Otherwise, the turn will end when the agent returns
        this.findAgent(this.AttackingPlayer)
          .doTurn(new PlayerGameView(this, this.AttackingPlayer))
          .then(resolve)
          .catch((error) => {
            reject(error);
          });
      });
    } catch (error) {
      const outError = error instanceof Error ? error.stack ?? error.message : String(error);
      console.error("Error during turn:", outError);
      this.GameLog.turnError(this.AttackingPlayer, String(error));
    }

    if (this.GameOver) return;

    // Discard energy if player did not use it
    if (this.AttackingPlayer.AvailableEnergy) {
      await this.delay();
      this.AttackingPlayer.discardEnergy([this.AttackingPlayer.AvailableEnergy], "energyZone");
      this.AttackingPlayer.AvailableEnergy = undefined;
    }

    await this.delay();

    // Pokemon Checkup phase
    this.GameLog.pokemonCheckup();

    const attacker = this.AttackingPlayer.ActivePokemon;
    const defender = this.DefendingPlayer.ActivePokemon;
    if (!attacker.isPokemon || !defender.isPokemon) {
      this.GameLog.invalidGameState();
      this.GameOver = true;
      return;
    }

    // Apply poison damage
    for (const pokemon of [attacker, defender]) {
      if (pokemon.SecondaryConditions.has("Poisoned")) {
        const initialHP = pokemon.CurrentHP;
        const damage = 10;
        const player = pokemon.player;

        pokemon.applyDamage(damage);
        this.GameLog.specialConditionDamage(player, "Poisoned", initialHP, damage);
      }
    }

    // Apply burn damage and flip to recover
    for (const pokemon of [attacker, defender]) {
      if (pokemon.SecondaryConditions.has("Burned")) {
        const initialHP = pokemon.CurrentHP;
        const damage = 20;
        const player = pokemon.player;

        pokemon.applyDamage(damage);
        this.GameLog.specialConditionDamage(player, "Burned", initialHP, damage);

        if (player.flipCoin()) {
          pokemon.SecondaryConditions.delete("Burned");
          this.GameLog.specialConditionEnded(player, ["Burned"]);
        }
      }
    }

    // Flip to wake up sleeping Pokemon
    for (const pokemon of [attacker, defender]) {
      if (pokemon.PrimaryCondition == "Asleep") {
        const player = pokemon.player;
        if (player.flipCoin()) {
          pokemon.PrimaryCondition = undefined;
          this.GameLog.specialConditionEnded(player, ["Asleep"]);
        }
      }
    }

    // Remove paralysis status from attacking player's Active Pokemon
    if (attacker.PrimaryCondition == "Paralyzed") {
      attacker.PrimaryCondition = undefined;
      this.GameLog.specialConditionEnded(this.AttackingPlayer, ["Paralyzed"]);
    }

    // Check for player and Pokemon statuses and remove if expired
    for (const player of [this.AttackingPlayer, this.DefendingPlayer]) {
      const newStatuses: PlayerStatus[] = [];
      for (const status of player.PlayerStatuses) {
        if (status.source == "Effect") {
          if (status.keepNextTurn) {
            status.keepNextTurn = false;
            newStatuses.push(status);
          }
        } else {
          newStatuses.push(status);
        }
      }
      player.PlayerStatuses = newStatuses;

      for (const pokemon of player.InPlayPokemon) {
        const newStatuses: PokemonStatus[] = [];
        for (const status of pokemon.PokemonStatuses) {
          if (status.source == "Effect") {
            if (status.keepNextTurn) {
              status.keepNextTurn = false;
              newStatuses.push(status);
            }
          } else {
            newStatuses.push(status);
          }
        }
        pokemon.PokemonStatuses = newStatuses;
      }
    }

    await this.afterAction();

    await this.delay();

    if (this.TurnNumber >= this.GameRules.TurnLimit) {
      this.GameLog.maxTurnNumberReached();
      this.GameOver = true;
      return;
    }
  }

  /**
   * This method is called at the end of every chain-of-events that the player can kick off by
   * performing any action (attacking, retreating, evolving, attaching Energy, etc.).
   */
  private async afterAction(): Promise<void> {
    await this.checkForKnockOuts();

    this.removeOutdatedPlayerStatuses();

    this.checkStatusAbilityConditions();

    this.checkForGameOver();
    if (this.GameOver) return;

    await this.ensureActivePokemon();
  }

  /**
   * Checks the game for any Pokémon that should be knocked out, then handles checking for game
   * over and choosing new Active Pokémon if necessary.
   *
   */
  private async checkForKnockOuts(): Promise<void> {
    const attackerPrizePoints = this.AttackingPlayer.GamePoints;
    const defenderPrizePoints = this.DefendingPlayer.GamePoints;

    // Check for any pokemon that are knocked out
    for (const player of [this.DefendingPlayer, this.AttackingPlayer]) {
      for (const pokemon of player.InPlayPokemon) {
        if (pokemon.CurrentHP <= 0) {
          const fromAttack = this.AttackKnockedOutPokemon.has(pokemon);
          await this.handleKnockOut(pokemon, fromAttack);
        }
      }
    }

    this.AttackingPlayer.checkPrizePointsChange(attackerPrizePoints);
    this.DefendingPlayer.checkPrizePointsChange(defenderPrizePoints);
  }

  /**
   * Checks all player statuses applied by abilities and removes those whose inflictors are no
   * longer in play.
   */
  private removeOutdatedPlayerStatuses() {
    for (const player of [this.DefendingPlayer, this.AttackingPlayer]) {
      for (const status of player.PlayerStatuses) {
        if (status.source === "Ability") {
          const triggeringPokemon = [
            ...this.DefendingPlayer.InPlayPokemon,
            ...this.AttackingPlayer.InPlayPokemon,
          ].filter((p) => p.ActivePlayerStatuses.some((s) => s.id === status.id));

          let validPokemon = false;
          for (const pokemon of triggeringPokemon) {
            if (
              pokemon.Ability?.type === "Status" &&
              pokemon.Ability.effect.status.id === status.id
            ) {
              validPokemon = true;
            } else {
              removeElement(pokemon.ActivePlayerStatuses, status);
            }
          }

          if (!validPokemon) player.removePlayerStatus(status.id!);
        }
      }
    }
  }

  /**
   * Checks all Pokémon abilities that apply statuses and applies or removes them as necessary.
   */
  private checkStatusAbilityConditions() {
    for (const player of [this.AttackingPlayer, this.DefendingPlayer]) {
      for (const pokemon of player.InPlayPokemon) {
        const ability = pokemon.Ability;
        if (ability?.type !== "Status") continue;

        const applyStatus = ability.conditions.every((cond) => cond(pokemon));

        if (ability.effect.type === "PlayerStatus") {
          const statusPlayer = ability.effect.opponent ? player.opponent : player;
          const existingStatus = pokemon.ActivePlayerStatuses.find(
            (s) => s.id === ability.effect.status.id
          );

          if (existingStatus) {
            if (!applyStatus) statusPlayer.removePlayerStatus(existingStatus.id!);
          } else {
            if (applyStatus) statusPlayer.applyPlayerStatus(ability.effect.status, pokemon);
          }
        } else {
          if (pokemon.PokemonStatuses.some((x) => x.id === ability.effect.status.id)) {
            if (!applyStatus) pokemon.removePokemonStatus(ability.effect.status);
          } else {
            if (applyStatus) pokemon.applyPokemonStatus(ability.effect.status);
          }
        }
      }
    }
  }

  /**
   * Checks whether the game is over and determines the winner if it is.
   */
  private checkForGameOver(): void {
    const player1WinConditions = [];
    const player2WinConditions = [];

    /**
     * There are two main win conditions:
     * 1. A player has reached 3 prize points
     * 2. A player's opponent has no Pokemon left in play
     *
     * Once either of these conditions is met, the game is over, and the player with the most win
     * conditions wins. If both players have the same amount of win conditions, the game is a draw.
     *
     * For example, if player 1 scores their third prize point while knocking out their own Active
     * Pokemon to give player 2 their second prize point, but player 2 has Pokemon on the Bench
     * while player 1 does not, both players have only one win condition, so the game is a draw.
     */
    if (this.Player1.InPlayPokemon.length == 0) {
      player2WinConditions.push("noPokemonLeft");
    }
    if (this.Player2.InPlayPokemon.length == 0) {
      player1WinConditions.push("noPokemonLeft");
    }
    if (this.Player1.GamePoints >= this.GameRules.PrizePoints) {
      player1WinConditions.push("maxPrizePointsReached");
    }
    if (this.Player2.GamePoints >= this.GameRules.PrizePoints) {
      player2WinConditions.push("maxPrizePointsReached");
    }

    // If either player has reached a win condition, the game is over
    if (player1WinConditions.length > 0 || player2WinConditions.length > 0) {
      if (player1WinConditions.length > player2WinConditions.length) {
        this.GameLog.logWinner(this.Player1.Name, player1WinConditions);
      } else if (player1WinConditions.length < player2WinConditions.length) {
        this.GameLog.logWinner(this.Player2.Name, player2WinConditions);
      } else {
        this.GameLog.bothPlayersGameOver();
      }

      this.GameOver = true;
    }
  }

  /**
   * If either player has no Active Pokémon, prompts them to choose a new one from their Bench.
   */
  private async ensureActivePokemon(): Promise<void> {
    const promises = [];
    if (!this.Player1.ActivePokemon.isPokemon) {
      promises[0] = this.Agent1.swapActivePokemon(
        new PlayerGameView(this, this.Player1),
        "activeKnockedOut"
      );
    }
    if (!this.Player2.ActivePokemon.isPokemon) {
      promises[1] = this.Agent2.swapActivePokemon(
        new PlayerGameView(this, this.Player2),
        "activeKnockedOut"
      );
    }
    if (promises.length > 0) {
      await this.delay();
      const newActive = await Promise.all(promises);
      if (newActive[0])
        await this.Player1.setNewActivePokemon(
          this.viewToPokemon(newActive[0], this.Player1.BenchedPokemon)
        );
      if (newActive[1])
        await this.Player2.setNewActivePokemon(
          this.viewToPokemon(newActive[1], this.Player2.BenchedPokemon)
        );
    }
  }

  /**
   * Handles knocking out of a Pokémon that has had its HP reduced to 0.
   * @param fromAttack whether the knockout is considered by the game to be "from an attack".
   */
  private async handleKnockOut(pokemon: InPlayPokemonCard, fromAttack: boolean): Promise<void> {
    await pokemon.player.handleKnockOut(pokemon, fromAttack);

    pokemon.player.opponent.GamePoints += pokemon.PrizePoints;
  }

  // Helper methods for the attack process

  private flipCoinsForAttack(coinsToFlip: CoinFlipIndicator): number {
    if (coinsToFlip === "UntilTails") {
      return this.AttackingPlayer.flipUntilTails().heads;
    } else if (typeof coinsToFlip === "number") {
      if (coinsToFlip === 1) {
        return +this.AttackingPlayer.flipCoin();
      }
      return this.AttackingPlayer.flipMultiCoins(coinsToFlip).heads;
    }

    const actualCount = coinsToFlip(this, this.AttackingPokemon!);
    return this.AttackingPlayer.flipMultiCoins(actualCount).heads;
  }

  private shouldPreventDamage(pokemon: InPlayPokemonCard): boolean {
    if (!this.CurrentAttack) return false;
    return pokemon.PokemonStatuses.some(
      (status) =>
        (status.type === "PreventAttackDamage" ||
          status.type === "PreventAttackDamageAndEffects") &&
        (!status.attackerCondition ||
          status.attackerCondition.test(this.AttackingPlayer.activeOrThrow()))
    );
  }

  private shouldPreventEffects(pokemon: InPlayPokemonCard): boolean {
    if (!this.CurrentAttack) return false;
    if (!this.DefendingPlayer.InPlayPokemon.includes(pokemon)) return false;
    return pokemon.PokemonStatuses.some(
      (status) =>
        (status.type === "PreventAttackEffects" ||
          status.type === "PreventAttackDamageAndEffects") &&
        (!status.attackerCondition ||
          status.attackerCondition.test(this.AttackingPlayer.activeOrThrow()))
    );
  }

  /**
   * Executes an attack with the attacking player's Active Pokémon.
   *
   * Note: This method directly executes the given attack, without first checking for confusion or
   * similar status effects. It also does not check for knockouts when the attack ends. It is only
   * exposed to allow for an attack to copy another.
   *
   * To execute an attack "properly", call useAttack() instead.
   */
  async executeAttack(attack: Attack): Promise<void> {
    const attacker = this.AttackingPokemon;
    if (!attacker) throw new Error("Need an attacker to attack!");

    let flippedHeads: number = 0;
    if (attack.type === "CoinFlipOrDoNothing") {
      flippedHeads = +this.AttackingPlayer.flipCoin();
      if (flippedHeads === 0) {
        this.GameLog.attackFailed(this.AttackingPlayer);
        return;
      }
    }

    let chosenPokemon: InPlayPokemonCard | undefined;
    if (attack.choosePokemonToAttack) {
      const validPokemon = attack.choosePokemonToAttack(this, attacker);
      chosenPokemon = await this.choosePokemon(this.AttackingPlayer, validPokemon);
    }

    for (const effect of attack.preDamageEffects)
      await effect(this, attacker, flippedHeads, chosenPokemon);

    if (attack.type !== "NoBaseDamage") {
      let baseDamage: number = attack.baseDamage ?? 0;

      if (attack.type === "CoinFlipForDamage" || attack.type === "CoinFlipForAddedDamage") {
        if (!attack.coinsToFlip)
          throw new Error(attack.name + " needs to know how many coins to flip");
        flippedHeads = this.flipCoinsForAttack(attack.coinsToFlip);
      }

      if (attack.calculateDamage) {
        baseDamage = attack.calculateDamage(this, attacker, flippedHeads);
      } else if (attack.type === "CoinFlipForDamage" || attack.type === "CoinFlipForAddedDamage") {
        throw new Error(attack.name + " needs to know how much damage to deal");
      }

      const defender = this.DefendingPlayer.activeOrThrow();
      this.attackPokemon(defender, baseDamage);
    }

    if (
      (attack.type === "NoBaseDamage" || attack.type === "PredeterminableDamage") &&
      attack.coinsToFlip
    ) {
      flippedHeads = this.flipCoinsForAttack(attack.coinsToFlip);
    }

    for (const effect of attack.attackingEffects)
      await effect(this, attacker, flippedHeads, chosenPokemon);

    for (const effect of attack.sideEffects)
      await effect(this, attacker, flippedHeads, chosenPokemon);
  }

  // Methods to cover any action a player can take and execute the proper follow-up effects

  /**
   * Launches an attack with the attacking player's Active Pokémon. Ends the turn when the attack
   * finishes.
   */
  async useAttack(attack: Attack): Promise<void> {
    const attacker = this.AttackingPlayer.activeOrThrow();

    let coinFlipsToAttack = attacker.PokemonStatuses.filter(
      (status) => status.type === "CoinFlipToAttack"
    ).length;
    if (attacker.PrimaryCondition === "Confused") {
      this.GameLog.specialConditionEffective(this.AttackingPlayer);
      coinFlipsToAttack += 1;
    }

    while (coinFlipsToAttack-- > 0) {
      if (!this.AttackingPlayer.flipCoin()) {
        this.GameLog.attackFailed(this.AttackingPlayer);
        this.endTurnResolve(true);
        return;
      }
    }

    this.GameLog.useAttack(this.AttackingPlayer, attack.name);

    this.CurrentAttack = attack;
    this.AttackingPokemon = attacker;

    await this.executeAttack(attack);

    for (const pokemon of this.AttackDamagedPokemon) {
      await pokemon.afterDamagedByAttack();
    }

    await this.afterAction();

    this.CurrentAttack = undefined;
    this.AttackingPokemon = undefined;

    this.endTurnResolve(true);
  }

  /**
   * Manually triggers a Pokémon's Ability.
   */
  async useAbility(pokemon: InPlayPokemonCard, ability: Ability): Promise<void> {
    if (pokemon.Ability !== ability) {
      throw new Error("Pokemon does not have this ability");
    }
    if (ability.type !== "Standard" || ability.trigger.type !== "Manual") {
      throw new Error("Ability cannot be used manually");
    }
    if (!ability.trigger.multiUse) {
      if (this.UsedAbilities.has(pokemon)) {
        throw new Error("Pokemon's ability has already been used this turn");
      }
      this.UsedAbilities.add(pokemon);
    }
    if (ability.effect.type === "Targeted") {
      if (ability.effect.findValidTargets(this, pokemon).length === 0) {
        throw new Error("No valid targets for ability");
      }
    }

    await pokemon.useAbility(true);
    await this.afterAction();
  }

  /**
   * Attaches the player's current Energy from their Energy Zone to one of their Pokémon.
   */
  async attachAvailableEnergy(pokemon: InPlayPokemonCard): Promise<void> {
    await this.AttackingPlayer.attachAvailableEnergy(pokemon);
    await this.afterAction();
  }

  /**
   * Plays a Basic Pokémon from the player's hand to one of their open Bench slots.
   */
  async putPokemonOnBench(pokemon: PokemonCard, index: number): Promise<void> {
    await this.AttackingPlayer.putPokemonOnBench(pokemon, index);
    await this.afterAction();
  }

  /**
   * Plays an Evolution Pokémon from the player's hand to evolve one of their Pokémon.
   */
  async evolvePokemon(inPlayPokemon: InPlayPokemonCard, pokemon: PokemonCard): Promise<void> {
    await this.AttackingPlayer.evolvePokemon(inPlayPokemon, pokemon);
    await this.afterAction();
  }

  /**
   * Retreats the player's Active Pokémon using the given Energy to pay the Retreat Cost.
   */
  async retreatActivePokemon(benchedPokemon: InPlayPokemonCard, energy: Energy[]): Promise<void> {
    await this.AttackingPlayer.retreatActivePokemon(benchedPokemon, energy);
    await this.afterAction();
  }

  /**
   * Plays a Trainer card from the player's hand. If the card requires a target (e.g. Potion,
   * Misty, any Pokémon Tool), it must be given here.
   */
  async playTrainer(card: TrainerCard, target?: CardSlot): Promise<void> {
    if (!this.AttackingPlayer.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.CardType == "Supporter") {
      if (!this.CanPlaySupporter) {
        throw new Error("Cannot play supporter card currently");
      }
      this.CanPlaySupporter = false;
    }

    removeElement(this.AttackingPlayer.Hand, card);
    this.ActiveTrainerCard = card;

    if (card.CardType === "PokemonTool") {
      if (!target || !target.isPokemon)
        throw new Error("Pokémon Tool card requires a target Pokémon");
      if (target.AttachedToolCards.length >= target.MaxToolCards)
        throw new Error("Target Pokémon cannot have any more Tool cards attached");

      await target.attachPokemonTool(card);
    } else {
      this.GameLog.playTrainer(this.AttackingPlayer, card);

      if (card.Effect.type === "Targeted") {
        if (!target) {
          throw new Error("Targeted effect requires a target");
        }
        const validTargets = card.Effect.validTargets(this);
        if (!validTargets.includes(target)) {
          throw new Error("Invalid target for targeted effect");
        }
        await card.Effect.effect(this, target);
      } else if (card.Effect.type === "Conditional") {
        if (card.Effect.condition(this, this.AttackingPlayer)) {
          await card.Effect.effect(this);
        }
      }
    }

    await this.afterAction();

    this.ActiveTrainerCard = undefined;
    // Workaround for fossils being put into play by their effect
    // Otherwise we could always push to discard
    if (!this.AttackingPlayer.InPlay.includes(card)) {
      this.AttackingPlayer.Discard.push(card);
      this.GameLog.discardFromHand(this.AttackingPlayer, [card]);
    }
  }

  // Methods for attack, ability, and trainer effects to call to perform game actions
  // Any action that can be prevented with a status effect should be called through these methods

  /**
   * Hits a Pokémon for a base amount of damage, after applying weakness and status effects.
   */
  attackPokemon(defender: InPlayPokemonCard, HP: number): void {
    if (this.shouldPreventDamage(defender)) {
      this.GameLog.damagePrevented(this.DefendingPlayer, defender);
      return;
    }

    const attacker = this.AttackingPlayer.activeOrThrow();
    const type = attacker.Type;
    const initialHP = defender.CurrentHP;
    const owner = this.DefendingPlayer;
    const attackingActive = defender == owner.ActivePokemon;

    let totalDamage = HP;
    let weaknessBoost = false;

    // First, apply any of the attacker's own damage modification statuses
    // Currently all modifications only affect the opponent's Active Pokemon--this may change
    if (totalDamage > 0 && attackingActive) {
      for (const status of this.AttackingPlayer.PlayerStatuses) {
        if (status.type === "IncreaseAttack" && status.appliesToPokemon(attacker, this))
          totalDamage += status.amount;
      }
      for (const status of attacker.PokemonStatuses) {
        if (status.type == "ReduceOwnAttackDamage") {
          totalDamage -= status.amount;
        } else if (status.type == "IncreaseDamageOfAttack") {
          if (status.attackName == this.CurrentAttack?.name) totalDamage += status.amount;
        }
      }
    }

    // Next, add weakness boost
    if (totalDamage > 0 && attackingActive) {
      if (type == defender.Weakness) {
        totalDamage += 20;
        weaknessBoost = true;
      }
    }

    // After that, apply any damage modification statuses on the defender
    if (totalDamage > 0) {
      if (owner === this.DefendingPlayer) {
        for (const status of this.DefendingPlayer.PlayerStatuses) {
          if (status.type === "IncreaseDefense" && status.appliesToPokemon(attacker, this))
            totalDamage -= status.amount;
        }
      }
      for (const status of defender.PokemonStatuses) {
        if (status.type == "ReduceAttackDamage") {
          if (status.attackerCondition && !status.attackerCondition.test(attacker)) continue;
          totalDamage -= status.amount;
        }
      }
    }

    // Finally, set a floor of 0 damage to avoid accidental healing
    if (totalDamage < 0) totalDamage = 0;

    defender.applyDamage(totalDamage);
    this.GameLog.attackDamage(owner, defender, initialHP, totalDamage, weaknessBoost);

    if (totalDamage > 0) {
      this.AttackDamagedPokemon.add(defender);
      if (defender.CurrentHP <= 0) {
        this.AttackKnockedOutPokemon.add(defender);
      }
    }
  }

  /**
   * Applies a set amount of damage directly to a Pokémon, ignoring weakness or status effects.
   * @param fromAttack whether the damage is considered by the game to be "from an attack".
   */
  applyDamage(target: InPlayPokemonCard, HP: number, fromAttack: boolean): void {
    const initialHP = target.CurrentHP;

    target.applyDamage(HP);
    this.GameLog.pokemonDamaged(target.player, target, initialHP, HP, fromAttack);
  }

  /**
   * Directly knocks out a Pokémon from any amount of remaining HP.
   */
  async knockOutPokemon(pokemon: InPlayPokemonCard): Promise<void> {
    if (this.shouldPreventEffects(pokemon)) {
      this.GameLog.damagePrevented(pokemon.player, pokemon);
      return;
    }

    await this.handleKnockOut(pokemon, false);
  }

  /**
   * Heals a set amount of damage from a Pokémon.
   */
  healPokemon(target: InPlayPokemonCard, HP: number): void {
    const initialHP = target.CurrentHP;

    target.healDamage(HP);
    this.GameLog.pokemonHealed(target.player, target, initialHP, HP);
  }

  /**
   * Discards (up to) a given amount of a given type of Energy from a Pokémon.
   */
  async discardEnergy(pokemon: InPlayPokemonCard, type: Energy, count: number): Promise<void> {
    if (this.shouldPreventEffects(pokemon)) return;
    await pokemon.player.discardEnergyFromPokemon(pokemon, type, count);
  }
  /**
   * Discards all Energy from a Pokémon.
   */
  async discardAllEnergy(pokemon: InPlayPokemonCard): Promise<void> {
    if (this.shouldPreventEffects(pokemon)) return;
    await pokemon.player.discardAllEnergyFromPokemon(pokemon);
  }
  /**
   * Discards 1 or more random Energy from a Pokémon.
   */
  async discardRandomEnergy(pokemon: InPlayPokemonCard, count: number = 1): Promise<void> {
    if (this.shouldPreventEffects(pokemon)) return;
    await pokemon.player.discardRandomEnergyFromPokemon(pokemon, count);
  }

  /**
   * Discards a given tool or tools from a Pokémon. Discards all by default.
   */
  async discardPokemonTools(
    pokemon: InPlayPokemonCard,
    tools: PokemonToolCard[] = pokemon.AttachedToolCards
  ): Promise<void> {
    if (this.shouldPreventEffects(pokemon)) return;
    if (tools.length === 0) return;

    for (const tool of tools) {
      await pokemon.removePokemonTool(tool);
      pokemon.player.Discard.push(tool);
    }
    this.GameLog.discardFromPlay(pokemon.player, tools);
  }

  /**
   * Applies a given PokemonStatus to a Pokémon.
   */
  applyPokemonStatus(pokemon: InPlayPokemonCard, status: PokemonStatus) {
    if (this.shouldPreventEffects(pokemon)) return;
    pokemon.applyPokemonStatus(status);
  }

  /**
   * Makes the Defending Pokémon Poisoned.
   */
  poisonDefendingPokemon() {
    if (this.shouldPreventEffects(this.DefendingPlayer.activeOrThrow())) return;
    this.DefendingPlayer.poisonActivePokemon();
  }
  /**
   * Makes the Defending Pokémon Burned.
   */
  burnDefendingPokemon() {
    if (this.shouldPreventEffects(this.DefendingPlayer.activeOrThrow())) return;
    this.DefendingPlayer.burnActivePokemon();
  }
  /**
   * Makes the Defending Pokémon Asleep.
   */
  sleepDefendingPokemon() {
    if (this.shouldPreventEffects(this.DefendingPlayer.activeOrThrow())) return;
    this.DefendingPlayer.sleepActivePokemon();
  }
  /**
   * Makes the Defending Pokémon Paralyzed.
   */
  paralyzeDefendingPokemon() {
    if (this.shouldPreventEffects(this.DefendingPlayer.activeOrThrow())) return;
    this.DefendingPlayer.paralyzeActivePokemon();
  }
  /**
   * Makes the Defending Pokémon Confused.
   */
  confuseDefendingPokemon() {
    if (this.shouldPreventEffects(this.DefendingPlayer.activeOrThrow())) return;
    this.DefendingPlayer.confuseActivePokemon();
  }

  /**
   * Puts a Fossil card onto the Bench as if it were a Pokémon.
   */
  async putFossilOnBench(card: FossilCard, index: number, hp: number, type: Energy = "Colorless") {
    const pokemon: PlayingCard = {
      ID: card.ID,
      Name: card.Name,
      CardType: "Pokemon",
      Type: type,
      BaseHP: Number(hp),
      Stage: 0,
      RetreatCost: -1,
      Weakness: "",
      PrizePoints: 1,
      Attacks: [],
      Ability: {
        type: "Standard",
        name: "Discard",
        trigger: { type: "Manual", multiUse: false },
        conditions: [],
        text: "Discard this Pokémon from play.",
        effect: {
          type: "Standard",
          effect: async (game: Game, self: InPlayPokemonCard) => {
            await game.AttackingPlayer.discardPokemonFromPlay(self);
          },
        },
      },
    };

    await this.AttackingPlayer.putPokemonOnBench(pokemon, index, card);
    await this.afterAction();
  }

  // Methods to interact with the player agents

  private findAgent(player: Player) {
    return player == this.Player1 ? this.Agent1 : this.Agent2;
  }

  /**
   * Asks a player to choose a new Active Pokémon from among their Benched Pokémon.
   * If they have no Benched Pokémon, this does nothing.
   */
  async swapActivePokemon(
    player: Player,
    reason: "selfEffect" | "opponentEffect"
  ): Promise<boolean> {
    if (this.shouldPreventEffects(player.activeOrThrow())) return false;
    await this.delay();
    if (player.BenchedPokemon.length == 0) {
      this.GameLog.noBenchedPokemon(player);
      return false;
    }

    let newActive = player.BenchedPokemon[0]!;
    if (player.BenchedPokemon.length > 1) {
      const agent = this.findAgent(player);
      const newActiveView = await agent.swapActivePokemon(new PlayerGameView(this, player), reason);
      newActive = this.viewToPokemon(newActiveView, player.BenchedPokemon);
    }

    await player.swapActivePokemon(newActive, reason);
    return true;
  }

  /**
   * Asks a player to choose from a selection of Pokémon.
   */
  async choosePokemon(
    player: Player,
    validPokemon: InPlayPokemonCard[]
  ): Promise<InPlayPokemonCard | undefined> {
    if (validPokemon.length == 0) {
      this.GameLog.noValidTargets(player);
      return;
    }
    if (validPokemon.length == 1) return validPokemon[0];

    const agent = this.findAgent(player);
    const selectedView = await agent.choosePokemon(
      validPokemon.map((p) => new PlayerPokemonView(p))
    );
    const selected = this.viewToPokemon(selectedView, validPokemon);
    return selected;
  }

  /**
   * Asks a player to choose from a selection of any type of object. For Pokémon specifically,
   * use `.choosePokemon()`.
   */
  async choose<T>(player: Player, options: T[]): Promise<T | undefined> {
    if (options.length == 0) {
      this.GameLog.noValidTargets(player);
      return;
    }
    if (options.length == 1) return options[0];

    const agent = this.findAgent(player);
    const selected = await agent.choose(options);
    if (!options.includes(selected)) {
      throw new Error("Invalid option selected");
    }
    return selected;
  }

  /**
   * Asks a player to choose N options from a selection of any type of object.
   */
  async chooseNPokemon(
    player: Player,
    options: InPlayPokemonCard[],
    n: number
  ): Promise<InPlayPokemonCard[]> {
    if (options.length == 0) {
      this.GameLog.noValidTargets(player);
      return [];
    }
    if (options.length <= n) return options.slice();

    const agent = this.findAgent(player);
    const selected = (
      await agent.chooseNPokemon(
        options.map((p) => new PlayerPokemonView(p)),
        n
      )
    ).map((v) => this.viewToPokemon(v, options));
    if (!isSubset(options, selected)) {
      throw new Error("Invalid option selected");
    }
    return selected;
  }

  /**
   * Asks a player to choose N options from a selection of any type of object. For Pokémon
   * specifically, use `.chooseNPokemon()`.
   */
  async chooseN<T>(player: Player, options: T[], n: number): Promise<T[]> {
    if (options.length == 0) {
      this.GameLog.noValidTargets(player);
      return [];
    }
    if (options.length <= n) return options.slice();

    const agent = this.findAgent(player);
    const selected = await agent.chooseN(options, n);
    if (!isSubset(options, selected)) {
      throw new Error("Invalid option selected");
    }
    return selected;
  }

  /**
   * Shows a player a set of cards that they aren't normally able to see.
   */
  async showCards(player: Player, cards: PlayingCard[]): Promise<void> {
    const cardIds = cards.map((card) => card.ID);
    this.GameLog.viewCards(player, cardIds);
    const agent = this.findAgent(player);
    await agent.viewCards(cards);
  }

  /**
   * Asks a player to distribute a set of Energy among a set of Pokémon.
   */
  async distributeEnergy(player: Player, energy: Energy[], validPokemon: InPlayPokemonCard[]) {
    const agent = this.findAgent(player);
    const distribution = await agent.distributeEnergy(
      validPokemon.map((p) => new PlayerPokemonView(p)),
      energy
    );
    const sorted = distribution.flat().sort().join(",");
    if (sorted !== energy.slice().sort().join(",")) throw new Error("Invalid energy distribution");

    for (const i in distribution) {
      if (+i >= validPokemon.length) throw new Error("Invalid energy distribution");
      const energies = distribution[i]!;
      if (energies.length == 0) continue;
      const pokemon = validPokemon[i]!;
      await player.attachEnergy(pokemon, energies, "energyZone");
    }
  }
}
