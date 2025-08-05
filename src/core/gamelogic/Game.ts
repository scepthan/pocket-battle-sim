import { GameLogger } from "../logging";
import { useDeckValidator } from "../parsing";
import type {
  Ability,
  Attack,
  Effect,
  Energy,
  PlayingCard,
  PokemonCard,
  TrainerCard,
} from "../types";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import { Player } from "./Player";
import { PlayerGameView } from "./PlayerGameView";
import type { GameRules, PlayerAgent } from "./types";

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
  RetreatCostModifier: number = 0;
  ActivePokemonDamageBoost: number = 0;
  NextTurnDamageReduction: number = 0;
  CurrentDamageReduction: number = 0;
  ActiveTrainerCard?: TrainerCard;
  UsedAbilities: Set<InPlayPokemonCard> = new Set();

  GameRules: GameRules = {
    DeckSize: 20,
    InitialHandSize: 5,
    MaxHandSize: 10,
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

    this.Player1 = new Player(name1, deck1, this.GameLog);
    this.Player2 = new Player(name2, deck2, this.GameLog);

    // Randomize who goes first based on a coin flip
    const players = [this.Player1, this.Player2];
    if (Math.random() >= 0.5) {
      players.reverse();
    }
    this.GameLog.startGame(players[0], players[1]);
    this.AttackingPlayer = players[0];
    this.DefendingPlayer = players[1];

    this.AttackingPlayer.setup(this.GameRules.InitialHandSize);
    this.DefendingPlayer.setup(this.GameRules.InitialHandSize);
  }

  async delay() {
    const delay = this.GameRules.DelayPerAction;
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  findOwner(pokemon: InPlayPokemonCard) {
    return this.Player1.InPlayPokemon.includes(pokemon) ? this.Player1 : this.Player2;
  }

  async start() {
    const [setup1, setup2] = await Promise.all([
      this.startPlayer(this.Agent1, this.Player1),
      this.startPlayer(this.Agent2, this.Player2),
    ]);

    this.Player1.setupPokemon(setup1);
    this.Player2.setupPokemon(setup2);

    while (this.TurnNumber < this.GameRules.TurnLimit && !this.GameOver) {
      try {
        await this.nextTurn();
      } catch (error) {
        console.error("Error during turn:", error);
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
    this.RetreatCostModifier = 0;
    this.ActivePokemonDamageBoost = 0;
    this.CurrentDamageReduction = this.NextTurnDamageReduction;
    this.NextTurnDamageReduction = 0;
    this.UsedAbilities = new Set();
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
    const status = this.AttackingPlayer.ActivePokemon!.PrimaryCondition;
    if (status == "Asleep" || status == "Paralyzed") {
      this.GameLog.specialConditionEffective(this.AttackingPlayer);
    }

    // Draw a card into the attacking player's hand
    this.AttackingPlayer.drawCards(1, this.GameRules.MaxHandSize);

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
      console.error("Error during turn:", error);
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
    if (attacker == undefined || defender == undefined) {
      this.GameLog.invalidGameState();
      this.GameOver = true;
      return;
    }

    // Apply poison damage
    for (const pokemon of [attacker, defender]) {
      if (pokemon.SecondaryConditions.has("Poisoned")) {
        const initialHP = pokemon.CurrentHP;
        const damage = 10;
        const player = this.findOwner(pokemon);

        pokemon.applyDamage(damage);
        this.GameLog.specialConditionDamage(player, "Poisoned", initialHP, damage);
      }
    }

    // Flip to wake up sleeping Pokemon
    for (const pokemon of [attacker, defender]) {
      if (pokemon.PrimaryCondition == "Asleep") {
        const player = this.findOwner(pokemon);
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

    await this.checkForKnockOuts();

    await this.delay();

    if (this.TurnNumber >= this.GameRules.TurnLimit) {
      this.GameLog.maxTurnNumberReached();
      this.GameOver = true;
      return;
    }
  }

  // Methods to do things during turns
  async useInitialEffect(effect: Effect, pokemon?: InPlayPokemonCard) {
    await this.useEffect(effect, pokemon);

    await this.checkForKnockOuts();
  }

  async useEffect(effect: Effect, pokemon?: InPlayPokemonCard) {
    await effect(this, pokemon);
  }

  async checkForKnockOuts() {
    const attackerPrizePoints = this.AttackingPlayer.GamePoints;
    const defenderPrizePoints = this.DefendingPlayer.GamePoints;

    // Check for any pokemon that are knocked out
    for (const player of [this.DefendingPlayer, this.AttackingPlayer]) {
      for (const pokemon of player.InPlayPokemon) {
        if (pokemon.CurrentHP <= 0) {
          this.knockOutPokemon(player, pokemon);
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
    if (this.Player1.GamePoints >= 3) {
      player1WinConditions.push("maxPrizePointsReached");
    }
    if (this.Player2.GamePoints >= 3) {
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
    if (this.Player1.ActivePokemon === undefined) {
      promises[0] = this.Agent1.swapActivePokemon(new PlayerGameView(this, this.Player1));
    }
    if (this.Player2.ActivePokemon === undefined) {
      promises[1] = this.Agent2.swapActivePokemon(new PlayerGameView(this, this.Player2));
    }
    if (promises.length > 0) {
      await this.delay();
      const newActive = await Promise.all(promises);
      if (newActive[0]) this.Player1.setNewActivePokemon(newActive[0]);
      if (newActive[1]) this.Player2.setNewActivePokemon(newActive[1]);
    }
  }

  // Methods to cover any action a player can take and execute the proper follow-up effects
  async useAttack(attack: Attack) {
    this.GameLog.useAttack(this.AttackingPlayer, attack.Name);

    await this.useInitialEffect(attack.Effect);
    this.endTurnResolve(true);
  }

  async useAbility(pokemon: InPlayPokemonCard, ability: Ability) {
    if (pokemon.Ability !== ability) {
      throw new Error("Pokemon does not have this ability");
    }
    if (ability.Trigger === "OnceDuringTurn") {
      if (this.UsedAbilities.has(pokemon)) {
        throw new Error("Pokemon's ability has already been used this turn");
      }
      this.UsedAbilities.add(pokemon);
    }
    if (ability.Conditions.includes("Active") && this.AttackingPlayer.ActivePokemon !== pokemon) {
      throw new Error("Ability can only be used if the Pokemon is Active");
    }

    this.GameLog.useAbility(this.AttackingPlayer, pokemon, ability.Name);

    await this.useInitialEffect(ability.Effect, pokemon);
  }

  async attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    await this.useInitialEffect(async (game) =>
      game.AttackingPlayer.attachAvailableEnergy(pokemon)
    );
  }

  async putPokemonOnBench(pokemon: PokemonCard, index: number) {
    await this.useInitialEffect(async (game) =>
      game.AttackingPlayer.putPokemonOnBench(pokemon, index)
    );
  }

  async evolvePokemon(inPlayPokemon: InPlayPokemonCard, pokemon: PokemonCard) {
    await this.useInitialEffect(async (game) =>
      game.AttackingPlayer.evolvePokemon(inPlayPokemon, pokemon)
    );
  }

  async retreatActivePokemon(benchedPokemon: InPlayPokemonCard, energy: Energy[]) {
    await this.useInitialEffect(async (game) =>
      game.AttackingPlayer.retreatActivePokemon(benchedPokemon, energy, this.RetreatCostModifier)
    );
  }

  async playTrainer(card: TrainerCard) {
    if (!this.AttackingPlayer.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.CardType == "Supporter") {
      if (!this.CanPlaySupporter) {
        throw new Error("Cannot play supporter card currently");
      }
      this.CanPlaySupporter = false;
    }

    this.AttackingPlayer.Hand.splice(this.AttackingPlayer.Hand.indexOf(card), 1);
    this.ActiveTrainerCard = card;

    this.GameLog.playTrainer(this.AttackingPlayer, card);

    await this.useInitialEffect(card.Effect);

    this.ActiveTrainerCard = undefined;
    // Workaround for fossils being put into play by their effect
    // Otherwise we could always push to discard
    if (!this.AttackingPlayer.InPlay.includes(card)) {
      this.AttackingPlayer.Discard.push(card);
      this.GameLog.discardFromHand(this.AttackingPlayer, [card]);
    }
  }

  //
  drawCards(count: number) {
    this.AttackingPlayer.drawCards(count, this.GameRules.MaxHandSize);
  }

  attackActivePokemon(HP: number) {
    const defender = this.DefendingPlayer.ActivePokemon!;
    return this.attackPokemon(defender, HP);
  }

  attackPokemon(defender: InPlayPokemonCard, HP: number) {
    const type = this.AttackingPlayer.ActivePokemon!.Type;
    const initialHP = defender.CurrentHP;
    const owner = this.DefendingPlayer;

    let totalDamage = HP;
    let weaknessBoost = false;
    if (totalDamage > 0 && defender == owner.ActivePokemon) {
      totalDamage += this.ActivePokemonDamageBoost;
      if (type == defender.Weakness) {
        totalDamage += 20;
        weaknessBoost = true;
      }
    }
    totalDamage -= this.CurrentDamageReduction;
    if (totalDamage < 0) totalDamage = 0;

    defender.applyDamage(totalDamage);

    this.GameLog.attackDamage(owner, defender, initialHP, totalDamage, weaknessBoost);

    return totalDamage;
  }

  applyDamage(target: InPlayPokemonCard, HP: number, fromAttack: boolean) {
    const initialHP = target.CurrentHP;
    const owner = this.findOwner(target);

    target.applyDamage(HP);

    this.GameLog.pokemonDamaged(owner, target, initialHP, HP, fromAttack);
  }

  knockOutPokemon(player: Player, pokemon: InPlayPokemonCard) {
    player.knockOutPokemon(pokemon);

    const opposingPlayer = player == this.Player1 ? this.Player2 : this.Player1;
    opposingPlayer.GamePoints += pokemon.PrizePoints;
  }

  healPokemon(target: InPlayPokemonCard, HP: number) {
    const initialHP = target.CurrentHP;
    const owner = this.findOwner(target);

    target.healDamage(HP);

    this.GameLog.pokemonHealed(owner, target, initialHP, HP);
  }

  discardEnergy(pokemon: InPlayPokemonCard, type: Energy, count: number) {
    const discardedEnergy: Energy[] = [];
    while (pokemon.AttachedEnergy.includes(type) && count > 0) {
      discardedEnergy.push(type);
      pokemon.AttachedEnergy.splice(pokemon.AttachedEnergy.indexOf(type), 1);
      count--;
    }

    this.findOwner(pokemon).discardEnergy(discardedEnergy, "effect");
  }
  discardAllEnergy(pokemon: InPlayPokemonCard) {
    const discardedEnergy = pokemon.AttachedEnergy.slice();
    pokemon.AttachedEnergy = [];

    this.findOwner(pokemon).discardEnergy(discardedEnergy, "effect");
  }

  findAgent(player: Player) {
    return player == this.Player1 ? this.Agent1 : this.Agent2;
  }
  async swapActivePokemon(player: Player, reason: "selfEffect" | "opponentEffect") {
    await this.delay();
    if (player.BenchedPokemon.length == 0) {
      this.GameLog.noBenchedPokemon(player);
      return false;
    }
    const agent = this.findAgent(player);
    const newActive = await agent.swapActivePokemon(new PlayerGameView(this, player));
    player.swapActivePokemon(newActive, reason);
    return true;
  }
  async choosePokemon(player: Player, validPokemon: InPlayPokemonCard[]) {
    if (validPokemon.length == 0) {
      this.GameLog.noValidTargets(player);
      return;
    }
    const agent = this.findAgent(player);
    const selected = await agent.choosePokemon(validPokemon);
    if (!validPokemon.includes(selected)) {
      throw new Error("Invalid Pokemon selected");
    }
    return selected;
  }
  async choose<T>(player: Player, options: T[]) {
    if (options.length == 0) {
      this.GameLog.noValidTargets(player);
      return;
    }
    const agent = this.findAgent(player);
    const selected = await agent.choose(options);
    if (!options.includes(selected)) {
      throw new Error("Invalid option selected");
    }
    return selected;
  }
  async showCards(player: Player, cards: PlayingCard[]) {
    const cardIds = cards.map((card) => card.ID);
    this.GameLog.viewCards(player, cardIds);
    const agent = this.findAgent(player);
    await agent.viewCards(cards);
  }

  reduceRetreatCost(modifier: number) {
    this.RetreatCostModifier -= modifier;
    const player = this.AttackingPlayer;
    this.GameLog.applyModifier(player, "retreatCost", modifier, this.RetreatCostModifier);
  }
  increaseAttackModifier(modifier: number) {
    this.ActivePokemonDamageBoost += modifier;
    const player = this.AttackingPlayer;
    this.GameLog.applyModifier(player, "activeDamage", modifier, this.RetreatCostModifier);
  }
  increaseDefenseModifier(modifier: number) {
    this.NextTurnDamageReduction += modifier;
    const player = this.AttackingPlayer;
    this.GameLog.applyModifier(player, "damageReduction", modifier, this.RetreatCostModifier);
  }
}
