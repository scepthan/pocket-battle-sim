import { useCoinFlip, useDeckValidator } from "@/composables";
import type {
  Ability,
  Attack,
  Effect,
  Energy,
  GameRules,
  PlayerAgent,
  PlayingCard,
  TrainerCard,
} from "@/types";
import { GameLogger } from "./GameLogger";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import { Player } from "./Player";
import { PlayerGameView } from "./PlayerGameView";

const { coinFlip, multiCoinFlip, untilTailsCoinFlip } = useCoinFlip();

export class GameState {
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
  };

  DelayPerAction: number = 0; // milliseconds

  GameOver: boolean = false;

  endTurnResolve: (value: unknown) => void = () => {};

  constructor(
    agent1: PlayerAgent,
    agent2: PlayerAgent,
    rules?: Partial<GameRules>
  ) {
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
    if (coinFlip()) {
      players.reverse();
    }
    this.GameLog.addEntry({
      type: "startGame",
      firstPlayer: players[0].Name,
      secondPlayer: players[1].Name,
    });
    this.AttackingPlayer = players[0];
    this.DefendingPlayer = players[1];

    this.AttackingPlayer.setup(this.GameRules.InitialHandSize);
    this.DefendingPlayer.setup(this.GameRules.InitialHandSize);
  }

  async delay() {
    if (this.DelayPerAction) {
      await new Promise((resolve) => setTimeout(resolve, this.DelayPerAction));
    }
  }
  findOwner(pokemon: InPlayPokemonCard) {
    return this.Player1.InPlayPokemon.includes(pokemon)
      ? this.Player1
      : this.Player2;
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
        this.GameLog.addEntry({
          type: "gameOver",
          draw: true,
          reason: "invalidGameState",
        });
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
      [this.AttackingPlayer, this.DefendingPlayer] = [
        this.DefendingPlayer,
        this.AttackingPlayer,
      ];
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
    this.GameLog.addEntry({
      type: "nextTurn",
      turnNumber: this.TurnNumber,
      attackingPlayer: this.AttackingPlayer.Name,
      defendingPlayer: this.DefendingPlayer.Name,
    });

    // Generate next energy for the attacking player
    if (this.TurnNumber > 1) {
      this.AttackingPlayer.AvailableEnergy = this.AttackingPlayer.NextEnergy; // Set the available energy for the attacking player
      this.AttackingPlayer.chooseNextEnergy();
      this.GameLog.addEntry({
        type: "generateNextEnergy",
        player: this.AttackingPlayer.Name,
        currentEnergy: this.AttackingPlayer.AvailableEnergy,
        nextEnergy: this.AttackingPlayer.NextEnergy,
      });
    }

    // Log the Special Conditions that will affect the Active Pokemon
    const status = this.AttackingPlayer.ActivePokemon!.PrimaryStatus;
    if (status == "Asleep" || status == "Paralyzed") {
      this.GameLog.addEntry({
        type: "pokemonStatusEffective",
        player: this.AttackingPlayer.Name,
        targetPokemon: this.AttackingPlayer.pokemonToDescriptor(
          this.AttackingPlayer.ActivePokemon!
        ),
        statusCondition: status,
      });
    }

    // Draw a card into the attacking player's hand
    this.AttackingPlayer.drawCards(1, this.GameRules.MaxHandSize);

    // Execute the player's turn
    try {
      await new Promise((resolve, reject) => {
        // Any attack and some other effects will end the turn immediately
        this.endTurnResolve = resolve;

        // Otherwise, the turn will end when the agent returns
        (this.AttackingPlayer == this.Player1 ? this.Agent1 : this.Agent2)
          .doTurn(new PlayerGameView(this, this.AttackingPlayer))
          .then(resolve)
          .catch((error) => {
            reject(error);
          });
      });
    } catch (error) {
      console.error("Error during turn:", error);
      this.GameLog.addEntry({
        type: "turnError",
        player: this.AttackingPlayer.Name,
        error: String(error),
      });
    }

    if (this.GameOver) return;

    // Discard energy if player did not use it
    if (this.AttackingPlayer.AvailableEnergy) {
      await this.delay();
      this.AttackingPlayer.discardEnergy(
        [this.AttackingPlayer.AvailableEnergy],
        "energyZone"
      );
      this.AttackingPlayer.AvailableEnergy = undefined;
    }

    await this.delay();

    // Pokemon Checkup phase
    this.GameLog.addEntry({
      type: "pokemonCheckup",
    });

    // Apply poison damage
    for (const player of [this.AttackingPlayer, this.DefendingPlayer]) {
      const pokemon = player.ActivePokemon!;
      if (pokemon.SecondaryStatuses.has("Poisoned")) {
        const initialHP = pokemon.CurrentHP;
        const damage = 10;

        pokemon.applyDamage(damage);
        this.GameLog.addEntry({
          type: "pokemonStatusDamage",
          player: player.Name,
          statusCondition: "Poisoned",
          targetPokemon: player.pokemonToDescriptor(pokemon),
          initialHP: initialHP,
          damageDealt: damage,
          finalHP: pokemon.CurrentHP,
          maxHP: pokemon.BaseHP,
        });
      }
    }

    // Flip to wake up sleeping Pokemon
    for (const player of [this.AttackingPlayer, this.DefendingPlayer]) {
      const pokemon = player.ActivePokemon!;
      if (pokemon.PrimaryStatus == "Asleep") {
        if (this.flipCoin(player)) {
          pokemon.PrimaryStatus = undefined;
          this.GameLog.addEntry({
            type: "pokemonStatusEnded",
            player: player.Name,
            targetPokemon: player.pokemonToDescriptor(pokemon),
            statusConditions: ["Asleep"],
            currentStatusList: pokemon.CurrentStatuses,
          });
        }
      }
    }

    // Remove paralysis status from attacking player's Active Pokemon
    if (this.AttackingPlayer.ActivePokemon!.PrimaryStatus == "Paralyzed") {
      this.AttackingPlayer.ActivePokemon!.PrimaryStatus = undefined;
      this.GameLog.addEntry({
        type: "pokemonStatusEnded",
        player: this.AttackingPlayer.Name,
        targetPokemon: this.AttackingPlayer.pokemonToDescriptor(
          this.AttackingPlayer.ActivePokemon!
        ),
        statusConditions: ["Paralyzed"],
        currentStatusList: this.AttackingPlayer.ActivePokemon!.CurrentStatuses,
      });
    }

    await this.checkForKnockOuts();

    await this.delay();

    if (this.TurnNumber >= this.GameRules.TurnLimit) {
      this.GameLog.addEntry({
        type: "gameOver",
        draw: true,
        reason: "maxTurnNumberReached",
      });
      this.GameOver = true;
      return;
    }
  }

  // Methods to do things during turns
  async useInitialEffect(effect: Effect, pokemon?: InPlayPokemonCard) {
    await this.useEffect(effect, pokemon);

    await this.checkForKnockOuts();
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
        this.GameLog.addEntry({
          type: "gameOver",
          draw: false,
          winner: this.Player1.Name,
          reason: player1WinConditions.includes("maxPrizePointsReached")
            ? "maxPrizePointsReached"
            : "noPokemonLeft",
        });
      } else if (player1WinConditions.length < player2WinConditions.length) {
        this.GameLog.addEntry({
          type: "gameOver",
          draw: false,
          winner: this.Player2.Name,
          reason: player2WinConditions.includes("maxPrizePointsReached")
            ? "maxPrizePointsReached"
            : "noPokemonLeft",
        });
      } else {
        this.GameLog.addEntry({
          type: "gameOver",
          draw: true,
          reason: "bothPlayersGameOver",
        });
      }

      this.GameOver = true;
      return;
    }

    // Have players choose a new Active Pokemon if their previous one was knocked out
    const promises = [];
    if (this.Player1.ActivePokemon === undefined) {
      promises[0] = this.Agent1.swapActivePokemon(
        new PlayerGameView(this, this.Player1)
      );
    }
    if (this.Player2.ActivePokemon === undefined) {
      promises[1] = this.Agent2.swapActivePokemon(
        new PlayerGameView(this, this.Player2)
      );
    }
    if (promises.length > 0) {
      await this.delay();
      const newActive = await Promise.all(promises);
      if (newActive[0]) this.Player1.setNewActivePokemon(newActive[0]);
      if (newActive[1]) this.Player2.setNewActivePokemon(newActive[1]);
    }
  }

  async useEffect(effect: Effect, pokemon?: InPlayPokemonCard) {
    await effect(this, pokemon);
  }

  async useAttack(attack: Attack) {
    this.GameLog.addEntry({
      type: "useAttack",
      player: this.AttackingPlayer.Name,
      attackName: attack.Name,
      attackingPokemon: this.AttackingPlayer.pokemonToDescriptor(
        this.AttackingPlayer.ActivePokemon!
      ),
    });
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

    this.GameLog.addEntry({
      type: "useAbility",
      player: this.AttackingPlayer.Name,
      abilityName: ability.Name,
      abilityPokemon: this.AttackingPlayer.pokemonToDescriptor(pokemon),
    });

    await this.useInitialEffect(ability.Effect, pokemon);
  }

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

    let totalDamage = HP;
    let weaknessBoost = false;
    if (totalDamage > 0 && defender == this.DefendingPlayer.ActivePokemon) {
      totalDamage += this.ActivePokemonDamageBoost;
      if (type == defender.Weakness) {
        totalDamage += 20;
        weaknessBoost = true;
      }
    }
    totalDamage -= this.CurrentDamageReduction;
    if (totalDamage < 0) totalDamage = 0;

    defender.applyDamage(totalDamage);

    this.GameLog.addEntry({
      type: "pokemonDamaged",
      player: this.DefendingPlayer.Name,
      targetPokemon: this.DefendingPlayer.pokemonToDescriptor(defender),
      fromAttack: true,
      damageDealt: totalDamage,
      initialHP,
      finalHP: defender.CurrentHP,
      maxHP: defender.BaseHP,
      weaknessBoost,
    });

    return totalDamage;
  }

  applyDamage(target: InPlayPokemonCard, HP: number, fromAttack: boolean) {
    const initialHP = target.CurrentHP;
    const owner = this.findOwner(target);

    target.applyDamage(HP);

    this.GameLog.addEntry({
      type: "pokemonDamaged",
      player: owner.Name,
      targetPokemon: owner.pokemonToDescriptor(target),
      fromAttack,
      damageDealt: HP,
      initialHP,
      finalHP: target.CurrentHP,
      maxHP: target.BaseHP,
    });
  }

  knockOutPokemon(player: Player, pokemon: InPlayPokemonCard) {
    player.knockOutPokemon(pokemon);

    const opposingPlayer = player == this.Player1 ? this.Player2 : this.Player1;
    opposingPlayer.GamePoints += pokemon.PrizePoints;
  }

  healPokemon(target: InPlayPokemonCard, HP: number) {
    const initialHP = target.CurrentHP;

    target.healDamage(HP);

    this.GameLog.addEntry({
      type: "pokemonHealed",
      player: this.AttackingPlayer.Name,
      targetPokemon: this.AttackingPlayer.pokemonToDescriptor(target),
      initialHP,
      healingDealt: HP,
      finalHP: target.CurrentHP,
      maxHP: target.BaseHP,
    });
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

    this.AttackingPlayer.Hand.splice(
      this.AttackingPlayer.Hand.indexOf(card),
      1
    );
    this.ActiveTrainerCard = card;

    this.GameLog.addEntry({
      type: "playTrainer",
      player: this.AttackingPlayer.Name,
      cardId: card.ID,
      trainerType: card.CardType,
    });
    await this.useInitialEffect(card.Effect);

    this.ActiveTrainerCard = undefined;
    // Workaround for fossils being put into play by their effect
    // Otherwise we could always push to discard
    if (!this.AttackingPlayer.InPlay.includes(card)) {
      this.AttackingPlayer.Discard.push(card);
      this.GameLog.addEntry({
        type: "discardCards",
        player: this.AttackingPlayer.Name,
        source: "hand",
        cardIds: [card.ID],
      });
    }
  }

  flipCoin(player: Player) {
    const result = coinFlip();
    this.GameLog.addEntry({
      type: "coinFlip",
      player: player.Name,
      result: result ? "Heads" : "Tails",
    });
    return result;
  }
  flipMultiCoin(player: Player, count: number) {
    const result = multiCoinFlip(count);
    this.GameLog.addEntry({
      type: "coinMultiFlip",
      player: player.Name,
      flips: count,
      results: result.results.map((x) => (x ? "Heads" : "Tails")),
    });
    return result;
  }
  flipCoinUntilTails(player: Player) {
    const result = untilTailsCoinFlip();
    this.GameLog.addEntry({
      type: "coinFlipUntilTails",
      player: player.Name,
      results: result.results.map((x) => (x ? "Heads" : "Tails")),
    });
    return result;
  }

  async swapActivePokemon(
    player: Player,
    reason: "selfEffect" | "opponentEffect"
  ) {
    await this.delay();
    if (!player.Bench.some((x) => x !== undefined)) {
      this.GameLog.addEntry({
        type: "actionFailed",
        player: player.Name,
        reason: "noBenchedPokemon",
      });
      return false;
    }
    const agent = player == this.Player1 ? this.Agent1 : this.Agent2;
    const newActive = await agent.swapActivePokemon(
      new PlayerGameView(this, player)
    );
    player.swapActivePokemon(newActive, reason);
    return true;
  }
  async choosePokemon(player: Player, validPokemon: InPlayPokemonCard[]) {
    if (validPokemon.length == 0) {
      this.GameLog.addEntry({
        type: "actionFailed",
        player: player.Name,
        reason: "noValidTargets",
      });
      return;
    }
    const agent = player == this.Player1 ? this.Agent1 : this.Agent2;
    const selected = await agent.choosePokemon(validPokemon);
    if (!validPokemon.includes(selected)) {
      throw new Error("Invalid Pokemon selected");
    }
    return selected;
  }
  async showCards(player: Player, cards: PlayingCard[]) {
    this.GameLog.addEntry({
      type: "viewCards",
      player: player.Name,
      cardIds: cards.map((card) => card.ID),
    });
    const agent = player == this.Player1 ? this.Agent1 : this.Agent2;
    await agent.viewCards(cards);
  }

  reduceRetreatCost(modifier: number) {
    this.RetreatCostModifier -= modifier;
    this.GameLog.addEntry({
      type: "applyModifier",
      attribute: "retreatCost",
      player: this.AttackingPlayer.Name,
      newModifier: -modifier,
      totalModifier: this.RetreatCostModifier,
    });
  }
  increaseAttackModifier(modifier: number) {
    this.ActivePokemonDamageBoost += modifier;
    this.GameLog.addEntry({
      type: "applyModifier",
      attribute: "activeDamage",
      player: this.AttackingPlayer.Name,
      newModifier: modifier,
      totalModifier: this.ActivePokemonDamageBoost,
    });
  }
  increaseDefenseModifier(modifier: number) {
    this.NextTurnDamageReduction += modifier;
    this.GameLog.addEntry({
      type: "applyModifier",
      attribute: "damageReduction",
      player: this.AttackingPlayer.Name,
      newModifier: modifier,
      totalModifier: this.NextTurnDamageReduction,
    });
  }
}
