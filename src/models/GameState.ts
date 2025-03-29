import { Player } from "./Player";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";
import { useCoinFlip } from "@/composables/useCoinFlip";
import { useDeckValidator } from "@/composables/useDeckValidator";
import type { GameRules } from "@/types/GameRules";
import type { PlayerAgent, PlayerGameSetup } from "@/types/PlayerAgent";
import type { PokemonCard } from "@/types/PlayingCard";

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
  GameLog: string[] = [];

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

    this.Player1 = new Player(agent1.Name + " (1)", deck1);
    this.Player2 = new Player(agent2.Name + " (2)", deck2);

    // Randomize who goes first based on a coin flip
    const players = [this.Player1, this.Player2];
    if (coinFlip()) {
      players.reverse();
    }
    this.GameLog.push(players[0].Name + " wins the coin flip and goes first!");
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

    this.setupPlayer(this.Player1, setup1);
    this.setupPlayer(this.Player2, setup2);
    for (const player of [this.Player1, this.Player2]) {
      this.GameLog.push(
        `${player.Name} has setup their Pokémon:`,
        `- Active: ${player.ActivePokemon!.Name} (${player.ActivePokemon!.ID})`,
        `- Bench: ${
          player.Bench.filter((x) => x !== undefined)
            .map((x) => `${x.Name} (${x.ID})`)
            .join(", ") || "none"
        }`
      );
    }
  }

  async startPlayer(agent: PlayerAgent, player: Player) {
    const { active, bench } = await agent.setupPokemon({
      hand: player.Hand,
      firstEnergy: player.NextEnergy,
      isGoingFirst: player == this.AttackingPlayer,
    });
    const allPokemon = [active, ...bench.filter((x) => x !== undefined)];
    if (
      !allPokemon.every(
        (pokemon) => player.Hand.includes(pokemon) && pokemon.Stage == 0
      )
    ) {
      throw new Error("Can only setup Basic Pokemon from your hand");
    }
    if (
      allPokemon.some((p1, i1) =>
        allPokemon.some((p2, i2) => p1 == p2 && i1 != i2)
      )
    ) {
      throw new Error("Can't play the same card twice");
    }
    if (bench.some((_, i) => i > 2)) {
      throw new Error("Bench only has 3 slots");
    }

    return { active, bench };
  }

  setupPlayer(player: Player, setup: PlayerGameSetup) {
    player.ActivePokemon = new InPlayPokemonCard(setup.active);
    player.InPlay.push(setup.active);
    player.Hand.splice(player.Hand.indexOf(setup.active), 1);

    setup.bench.map((card, i) => {
      if (!card) return;
      this.putPokemonOnBench(player, card, i);
    });
  }

  putPokemonOnBench(player: Player, card: PokemonCard, index: number) {
    if (player.Bench[index]) {
      throw new Error("Bench already has a Pokemon in this slot");
    }
    if (!player.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.Stage != 0) {
      throw new Error("Can only play Basic Pokemon to bench");
    }

    player.Bench[index] = new InPlayPokemonCard(card);
    player.InPlay.push(card);
    player.Hand.splice(player.Hand.indexOf(card), 1);
  }

  playToBench(card: PokemonCard, index: number) {
    this.putPokemonOnBench(this.AttackingPlayer, card, index);
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
  }

  applyDamage(Pokemon: InPlayPokemonCard, HP: number) {
    Pokemon.applyDamage(HP);

    if (Pokemon.CurrentHP == 0) {
      // knocked out logic
    }
  }
}
