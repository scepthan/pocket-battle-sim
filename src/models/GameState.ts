import type { PlayingCard } from "@/types/PlayingCard";
import { Player } from "./Player";
import type { DeckInfo } from "@/types/DeckInfo";
import type { PokemonCard } from "./PokemonCard";
import type { Energy } from "@/types/Energy";
import { useCoinFlip } from "@/composables/useCoinFlip";

const { coinFlip } = useCoinFlip();

export class GameState {
  Player1: Player;
  Player2: Player;

  AttackingPlayer: Player;
  DefendingPlayer: Player;
  CanRetreat: boolean;
  CanPlaySupporter: boolean;

  constructor(deck1: DeckInfo, deck2: DeckInfo) {
    this.Player1 = new Player(deck1);
    this.Player2 = new Player(deck2);

    if (coinFlip()) {
      this.AttackingPlayer = this.Player1;
      this.DefendingPlayer = this.Player2;
    } else {
      this.AttackingPlayer = this.Player2;
      this.DefendingPlayer = this.Player1;
    }

    this.CanRetreat = true;
    this.CanPlaySupporter = true;
  }

  attackActivePokemon(HP: number) {
    let defender = this.DefendingPlayer.ActivePokemon;
    let attacker = this.AttackingPlayer.ActivePokemon;
    if (!defender || !attacker) return;
    this.attackPokemon(defender, HP, attacker.Type);
  }

  attackPokemon(defender: PokemonCard, HP: number, Type: Energy) {
    let totalDamage = HP;
    if (totalDamage > 0 && Type == defender.Weakness) {
      totalDamage += 20;
    }
    defender.applyDamage(totalDamage);
  }

  applyDamage(Pokemon: PokemonCard, HP: number) {
    Pokemon.applyDamage(HP);

    if (Pokemon.CurrentHP == 0) {
      // knocked out logic
    }
  }
}
