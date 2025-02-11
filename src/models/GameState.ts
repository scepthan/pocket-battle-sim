import { Player } from "./Player";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";
import { useCoinFlip } from "@/composables/useCoinFlip";
import { useDeckValidator } from "@/composables/useDeckValidator";
import type { GameRules } from "@/types/GameRules";
import type { PlayerAgent, PlayerGameSetup } from "@/types/PlayerAgent";

const { coinFlip } = useCoinFlip();

export class GameState {
  Agent1: PlayerAgent;
  Agent2: PlayerAgent;
  Player1: Player;
  Player2: Player;

  TurnNumber: number;
  AttackingPlayer: Player;
  DefendingPlayer: Player;
  CanRetreat: boolean;
  CanPlaySupporter: boolean;

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

    this.Player1 = new Player(deck1);
    this.Player2 = new Player(deck2);
    this.TurnNumber = 0;

    if (coinFlip()) {
      this.AttackingPlayer = this.Player1;
      this.DefendingPlayer = this.Player2;
    } else {
      this.AttackingPlayer = this.Player2;
      this.DefendingPlayer = this.Player1;
    }

    this.CanRetreat = true;
    this.CanPlaySupporter = true;

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
      player.Bench[i] = new InPlayPokemonCard(card);
      player.InPlay.push(card);
      player.Hand.splice(player.Hand.indexOf(card), 1);
    });
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
