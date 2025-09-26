import { GameLogger } from "../logging";
import { useDeckValidator } from "../parsing";
import { removeElement } from "../util";

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
  PlayerStatus,
  PlayingCard,
  PokemonCard,
  PokemonStatus,
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

  async delay() {
    const delay = this.GameRules.DelayPerAction;
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  viewToPokemon(view: PlayerPokemonView, validPokemon: InPlayPokemonCard[]) {
    const pokemon = validPokemon.find((p) => view.is(p));
    if (!pokemon) throw new Error("Invalid Pokémon selected");
    return pokemon;
  }

  async start() {
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

  async startPlayer(agent: PlayerAgent, player: Player) {
    return await agent.setupPokemon({
      hand: player.Hand,
      firstEnergy: player.NextEnergy,
      isGoingFirst: player == this.AttackingPlayer,
    });
  }

  async nextTurn() {
    if (this.TurnNumber > 0) {
      // Switch the attacking and defending players
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
      this.AttackingPlayer.AvailableEnergy = this.AttackingPlayer.NextEnergy; // Set the available energy for the attacking player
      this.AttackingPlayer.chooseNextEnergy();
      this.GameLog.generateNextEnergy(this.AttackingPlayer);
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

        // Flip to recover from burn
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

    await this.checkForKnockOuts();

    await this.delay();

    if (this.TurnNumber >= this.GameRules.TurnLimit) {
      this.GameLog.maxTurnNumberReached();
      this.GameOver = true;
      return;
    }
  }

  // Methods to do things during turns
  async checkForKnockOuts() {
    const attackerPrizePoints = this.AttackingPlayer.GamePoints;
    const defenderPrizePoints = this.DefendingPlayer.GamePoints;

    // Check for any pokemon that are knocked out
    for (const player of [this.DefendingPlayer, this.AttackingPlayer]) {
      for (const pokemon of player.InPlayPokemon) {
        if (pokemon.CurrentHP <= 0) {
          const fromAttack = this.AttackKnockedOutPokemon.has(pokemon);
          await this.knockOutPokemon(player, pokemon, fromAttack);
        }
      }
    }

    this.AttackingPlayer.checkPrizePointsChange(attackerPrizePoints);
    this.DefendingPlayer.checkPrizePointsChange(defenderPrizePoints);

    // Check for game over conditions
    const player1WinConditions = [];
    const player2WinConditions = [];

    // There are two main win conditions:
    // 1. A player has reached 3 prize points
    // 2. A player's opponent has no Pokemon left in play
    // Once either of these conditions is met, the game is over, and the player with the most win conditions wins.
    // If both players have the same number of win conditions, the game is a draw.
    // For example, if player 1 scores their third prize point while knocking out their own Active Pokemon to give player 2 their second prize point,
    // but player 2 has Pokemon on the Bench while player 1 does not, both players have only one win condition, so the game is a draw.
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
      return;
    }

    // Have players choose a new Active Pokemon if their previous one was knocked out
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

  flipCoinsForAttack(coinsToFlip: CoinFlipIndicator): number {
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

  /**
   * Executes an attack with the attacking player's Active Pokémon.
   *
   * Note: This method directly executes the given attack, without first checking for confusion or
   * similar status effects. It also does not check for knockouts when the attack ends.
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

      this.attackActivePokemon(baseDamage);
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
   * Launches an attack with the attacking player's Active Pokémon.
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
      await pokemon.onAttackDamage();
    }

    await this.checkForKnockOuts();

    this.CurrentAttack = undefined;
    this.AttackingPokemon = undefined;

    this.endTurnResolve(true);
  }

  async useAbility(pokemon: InPlayPokemonCard, ability: Ability) {
    if (pokemon.Ability !== ability) {
      throw new Error("Pokemon does not have this ability");
    }
    if (ability.trigger === "OnceDuringTurn") {
      if (this.UsedAbilities.has(pokemon)) {
        throw new Error("Pokemon's ability has already been used this turn");
      }
      this.UsedAbilities.add(pokemon);
    }

    let target: CardSlot | undefined;
    if (ability.effect.type === "Targeted") {
      const validTargets = ability.effect.findValidTargets(this, pokemon);
      if (validTargets.length === 0) throw new Error("No valid targets for ability");

      target = validTargets.every((x) => x.isPokemon)
        ? await this.choosePokemon(pokemon.player, validTargets)
        : await this.choose(pokemon.player, validTargets);
    }

    await pokemon.useAbility(true, target);

    await this.checkForKnockOuts();
  }

  async attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    this.AttackingPlayer.attachAvailableEnergy(pokemon);
    await this.checkForKnockOuts();
  }

  async putPokemonOnBench(pokemon: PokemonCard, index: number) {
    await this.AttackingPlayer.putPokemonOnBench(pokemon, index);
    await this.checkForKnockOuts();
  }
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
        name: "Discard",
        trigger: "OnceDuringTurn",
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
    await this.checkForKnockOuts();
  }

  async evolvePokemon(inPlayPokemon: InPlayPokemonCard, pokemon: PokemonCard) {
    await this.AttackingPlayer.evolvePokemon(inPlayPokemon, pokemon);
    await this.checkForKnockOuts();
  }

  async retreatActivePokemon(benchedPokemon: InPlayPokemonCard, energy: Energy[]) {
    await this.AttackingPlayer.retreatActivePokemon(benchedPokemon, energy);
    await this.checkForKnockOuts();
  }

  async playTrainer(card: TrainerCard, target?: CardSlot) {
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

    await this.checkForKnockOuts();

    this.ActiveTrainerCard = undefined;
    // Workaround for fossils being put into play by their effect
    // Otherwise we could always push to discard
    if (!this.AttackingPlayer.InPlay.includes(card)) {
      this.AttackingPlayer.Discard.push(card);
      this.GameLog.discardFromHand(this.AttackingPlayer, [card]);
    }
  }

  shouldPreventDamage(pokemon: InPlayPokemonCard): boolean {
    if (!this.CurrentAttack) return false;
    if (!this.DefendingPlayer.InPlayPokemon.includes(pokemon)) return false;
    return pokemon.PokemonStatuses.some(
      (status) =>
        (status.type === "PreventAttackDamage" ||
          status.type === "PreventAttackDamageAndEffects") &&
        (!status.attackerCondition ||
          status.attackerCondition.test(this.AttackingPlayer.activeOrThrow()))
    );
  }
  shouldPreventEffects(pokemon: InPlayPokemonCard): boolean {
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

  //
  drawCards(count: number) {
    this.AttackingPlayer.drawCards(count);
  }

  attackActivePokemon(HP: number) {
    const defender = this.DefendingPlayer.activeOrThrow();
    this.attackPokemon(defender, HP);
  }

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
      for (const status of this.DefendingPlayer.PlayerStatuses) {
        if (status.type === "IncreaseDefense" && status.appliesToPokemon(attacker, this))
          totalDamage -= status.amount;
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

  applyDamage(target: InPlayPokemonCard, HP: number, fromAttack: boolean) {
    const initialHP = target.CurrentHP;

    target.applyDamage(HP);

    this.GameLog.pokemonDamaged(target.player, target, initialHP, HP, fromAttack);
  }

  async knockOutPokemon(player: Player, pokemon: InPlayPokemonCard, fromAttack: boolean) {
    if (pokemon.CurrentHP > 0 && this.shouldPreventEffects(pokemon)) {
      this.GameLog.damagePrevented(player, pokemon);
      return;
    }
    await player.knockOutPokemon(pokemon, fromAttack);

    const opposingPlayer = player == this.Player1 ? this.Player2 : this.Player1;
    opposingPlayer.GamePoints += pokemon.PrizePoints;
  }

  healPokemon(target: InPlayPokemonCard, HP: number) {
    const initialHP = target.CurrentHP;

    target.healDamage(HP);

    this.GameLog.pokemonHealed(target.player, target, initialHP, HP);
  }

  discardEnergy(pokemon: InPlayPokemonCard, type: Energy, count: number) {
    if (this.shouldPreventEffects(pokemon)) return;
    const discardedEnergy: Energy[] = [];
    while (pokemon.AttachedEnergy.includes(type) && count > 0) {
      discardedEnergy.push(type);
      removeElement(pokemon.AttachedEnergy, type);
      count--;
    }

    pokemon.player.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  discardAllEnergy(pokemon: InPlayPokemonCard) {
    if (this.shouldPreventEffects(pokemon)) return;
    const discardedEnergy = pokemon.AttachedEnergy.slice();
    pokemon.AttachedEnergy = [];

    pokemon.player.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  discardRandomEnergy(pokemon: InPlayPokemonCard, count: number = 1) {
    if (this.shouldPreventEffects(pokemon)) return;
    if (pokemon.AttachedEnergy.length == 0) return;

    pokemon.player.discardRandomEnergy(pokemon, count);
  }

  applyPokemonStatus(pokemon: InPlayPokemonCard, status: PokemonStatus) {
    if (this.shouldPreventEffects(pokemon)) return;
    pokemon.applyPokemonStatus(status);
  }

  poisonDefendingPokemon() {
    if (this.shouldPreventEffects(this.AttackingPlayer.activeOrThrow())) return;
    this.AttackingPlayer.poisonActivePokemon();
  }
  burnDefendingPokemon() {
    if (this.shouldPreventEffects(this.AttackingPlayer.activeOrThrow())) return;
    this.AttackingPlayer.burnActivePokemon();
  }
  sleepDefendingPokemon() {
    if (this.shouldPreventEffects(this.AttackingPlayer.activeOrThrow())) return;
    this.AttackingPlayer.sleepActivePokemon();
  }
  paralyzeDefendingPokemon() {
    if (this.shouldPreventEffects(this.AttackingPlayer.activeOrThrow())) return;
    this.AttackingPlayer.paralyzeActivePokemon();
  }
  confuseDefendingPokemon() {
    if (this.shouldPreventEffects(this.AttackingPlayer.activeOrThrow())) return;
    this.AttackingPlayer.confuseActivePokemon();
  }

  findAgent(player: Player) {
    return player == this.Player1 ? this.Agent1 : this.Agent2;
  }
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
  async showCards(player: Player, cards: PlayingCard[]): Promise<void> {
    const cardIds = cards.map((card) => card.ID);
    this.GameLog.viewCards(player, cardIds);
    const agent = this.findAgent(player);
    await agent.viewCards(cards);
  }
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
      player.attachEnergy(pokemon, energies, "energyZone");
    }
  }
}
