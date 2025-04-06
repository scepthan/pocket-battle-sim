import { useCoinFlip, useDeckValidator } from "@/composables";
import type {
  Effect,
  Energy,
  GameRules,
  Move,
  PlayerAgent,
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

  TurnNumber: number = 0;
  AttackingPlayer: Player;
  DefendingPlayer: Player;
  CanRetreat: boolean = true;
  CanPlaySupporter: boolean = true;
  GameLog: GameLogger = new GameLogger();

  MaxHandSize: number = 10;
  MaxTurnNumber: number = 30;

  DelayPerAction: number = 1000; // milliseconds

  GameOver: boolean = false;

  endTurnResolve: (value: unknown) => void = () => {};

  constructor(rules: GameRules, agent1: PlayerAgent, agent2: PlayerAgent) {
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

    const { validateDeck } = useDeckValidator(rules);

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

    this.AttackingPlayer.setup(rules.HandSize);
    this.DefendingPlayer.setup(rules.HandSize);
  }

  async delay() {
    if (this.DelayPerAction) {
      await new Promise((resolve) => setTimeout(resolve, this.DelayPerAction));
    }
  }

  async start() {
    const [setup1, setup2] = await Promise.all([
      this.startPlayer(this.Agent1, this.Player1),
      this.startPlayer(this.Agent2, this.Player2),
    ]);

    this.Player1.setupPokemon(setup1);
    this.Player2.setupPokemon(setup2);

    while (this.TurnNumber < this.MaxTurnNumber && !this.GameOver) {
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

    // Draw a card into the attacking player's hand
    this.AttackingPlayer.drawCards(1, this.MaxHandSize);

    // Execute the player's turn
    try {
      await new Promise((resolve) => {
        // Any attack and some other effects will end the turn immediately
        this.endTurnResolve = resolve;

        // Otherwise, the turn will end when the agent returns
        (this.AttackingPlayer == this.Player1 ? this.Agent1 : this.Agent2)
          .doTurn(new PlayerGameView(this, this.AttackingPlayer))
          .then(resolve)
          .catch((error) => {
            throw error;
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
      this.GameLog.addEntry({
        type: "discardEnergy",
        player: this.AttackingPlayer.Name,
        source: "energyZone",
        energyTypes: [this.AttackingPlayer.AvailableEnergy],
      });
      this.AttackingPlayer.AvailableEnergy = undefined;
      await this.delay();
    }

    // Pokemon Checkup phase
    this.GameLog.addEntry({
      type: "pokemonCheckup",
    });

    await this.delay();

    if (this.TurnNumber >= this.MaxTurnNumber) {
      this.GameLog.addEntry({
        type: "gameOver",
        draw: true,
        reason: "maxTurnNumberReached",
      });
      return;
    }
  }

  // Methods to do things during turns
  async useInitialEffect(effect: Effect) {
    await this.useEffect(effect);

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
    if (
      this.Player1.InPlayPokemon.length == 0 ||
      this.Player2.InPlayPokemon.length == 0
    ) {
      // The primary win condition is actually having pokemon left in play when your opponent does not
      let winner: string | undefined = undefined;
      if (this.Player1.InPlayPokemon.length > 0) {
        winner = this.Player1.Name;
      } else if (this.Player2.InPlayPokemon.length > 0) {
        winner = this.Player2.Name;
      }

      this.GameLog.addEntry({
        type: "gameOver",
        draw: winner !== undefined,
        winner: winner,
        reason: "noPokemonLeft",
      });
      this.GameOver = true;
      return;
    } else if (this.Player1.GamePoints >= 3 || this.Player2.GamePoints >= 3) {
      // Secondary win condition: one player has more than 3 points and the other does not
      let winner: string | undefined = undefined;
      if (this.Player1.GamePoints < 3) {
        winner = this.Player2.Name;
      } else if (this.Player2.GamePoints < 3) {
        winner = this.Player1.Name;
      }

      this.GameLog.addEntry({
        type: "gameOver",
        draw: winner !== undefined,
        winner: winner,
        reason: "maxPrizePointsReached",
      });
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

  async useEffect(effect: Effect) {
    await effect(this);
  }

  async useAttack(attack: Move) {
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

  drawCards(count: number) {
    this.AttackingPlayer.drawCards(count, this.MaxHandSize);
  }

  attackActivePokemon(HP: number) {
    const defender = this.DefendingPlayer.ActivePokemon;
    const attacker = this.AttackingPlayer.ActivePokemon;
    if (!defender || !attacker) return;
    this.attackPokemon(defender, HP, attacker.Type);
  }

  attackPokemon(defender: InPlayPokemonCard, HP: number, Type: Energy) {
    let totalDamage = HP;
    if (totalDamage > 0 && Type == defender.Weakness) {
      totalDamage += 20;
    }
    const initialHP = defender.CurrentHP;
    defender.applyDamage(totalDamage);
    this.GameLog.addEntry({
      type: "pokemonDamaged",
      player: this.AttackingPlayer.Name,
      targetPokemon: this.AttackingPlayer.pokemonToDescriptor(defender),
      fromAttack: true,
      damageDealt: totalDamage,
      initialHP,
      finalHP: defender.CurrentHP,
      maxHP: defender.BaseHP,
      weaknessBoost: Type == defender.Weakness,
    });
  }

  applyDamage(pokemon: InPlayPokemonCard, HP: number) {
    pokemon.applyDamage(HP);
  }

  knockOutPokemon(player: Player, pokemon: InPlayPokemonCard) {
    player.knockOutPokemon(pokemon);

    const opposingPlayer = player == this.Player1 ? this.Player2 : this.Player1;
    opposingPlayer.GamePoints += pokemon.PrizePoints;
  }

  healPokemon(target: InPlayPokemonCard, HP: number) {
    target.healDamage(HP);
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
    this.GameLog.addEntry({
      type: "playTrainer",
      player: this.AttackingPlayer.Name,
      cardId: card.ID,
      trainerType: card.CardType,
    });
    await this.useInitialEffect(card.Effect);
    this.AttackingPlayer.discardCardsFromHand([card]);
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
}
