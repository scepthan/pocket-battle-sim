import { Player } from "./Player";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";
import { useCoinFlip } from "@/composables/useCoinFlip";
import { useDeckValidator } from "@/composables/useDeckValidator";
import type { GameRules } from "@/types/GameRules";
import type { PlayerAgent } from "@/types/PlayerAgent";
import { PlayerGameView } from "./PlayerGameView";
import { GameLogger } from "./GameLogger";
import type { Move } from "@/types/PlayingCard";

const { coinFlip } = useCoinFlip();

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

  async start() {
    const [setup1, setup2] = await Promise.all([
      this.startPlayer(this.Agent1, this.Player1),
      this.startPlayer(this.Agent2, this.Player2),
    ]);

    this.Player1.setupPokemon(setup1);
    this.Player2.setupPokemon(setup2);

    while (this.TurnNumber < this.MaxTurnNumber) {
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
    if (this.TurnNumber > 2) {
      if (this.AttackingPlayer.ActivePokemon)
        this.AttackingPlayer.ActivePokemon.ReadyToEvolve = true;
      for (const pokemon of this.AttackingPlayer.Bench) {
        if (pokemon) pokemon.ReadyToEvolve = true;
      }
    }

    // Draw a card into the attacking player's hand
    this.AttackingPlayer.drawCards(1, this.MaxHandSize);

    // Execute the player's turn
    try {
      await (this.AttackingPlayer == this.Player1
        ? this.Agent1
        : this.Agent2
      ).doTurn(new PlayerGameView(this, this.AttackingPlayer));
    } catch (error) {
      console.error("Error during turn:", error);
      this.GameLog.addEntry({
        type: "turnError",
        player: this.AttackingPlayer.Name,
        error: String(error),
      });
    }

    // Discard energy if player did not use it
    if (this.AttackingPlayer.AvailableEnergy) {
      this.GameLog.addEntry({
        type: "discardEnergy",
        player: this.AttackingPlayer.Name,
        source: "energyZone",
        energyTypes: [this.AttackingPlayer.AvailableEnergy],
      });
      this.AttackingPlayer.AvailableEnergy = undefined;
    }

    // Pokemon Checkup phase
    this.GameLog.addEntry({
      type: "pokemonCheckup",
    });

    if (this.TurnNumber >= this.MaxTurnNumber) {
      this.GameLog.addEntry({
        type: "gameOver",
        draw: true,
        reason: "maxTurnNumberReached",
      });
      return;
    }
  }

  useAttack(attack: Move) {
    this.GameLog.addEntry({
      type: "useAttack",
      player: this.AttackingPlayer.Name,
      attackName: attack.Name,
      attackingPokemon: this.AttackingPlayer.pokemonToDescriptor(
        this.AttackingPlayer.ActivePokemon!
      ),
    });
    this.attackActivePokemon(20);
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
    defender.applyDamage(totalDamage);
    this.GameLog.addEntry({
      type: "pokemonDamaged",
      player: this.AttackingPlayer.Name,
      targetPokemon: this.AttackingPlayer.pokemonToDescriptor(defender),
      fromAttack: true,
      damageDealt: HP,
      initialHP: defender.CurrentHP + HP,
      finalHP: defender.CurrentHP,
      maxHP: defender.BaseHP,
    });
  }

  applyDamage(Pokemon: InPlayPokemonCard, HP: number) {
    Pokemon.applyDamage(HP);

    if (Pokemon.CurrentHP == 0) {
      // knocked out logic
    }
  }
}
