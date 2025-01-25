import { Player } from "./Player";
import type { DeckInfo } from "@/types/Deck";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";
import { useCoinFlip } from "@/composables/useCoinFlip";
import { useDeckValidator } from "@/composables/useDeckValidator";
import type { GameRules } from "@/types/GameRules";
import { usePlayingCardStore } from "@/stores/usePlayingCardStore";

const { coinFlip } = useCoinFlip();
const { parseDeck } = usePlayingCardStore();

export class GameState {
  Player1: Player;
  Player2: Player;

  TurnNumber: number;
  AttackingPlayer: Player;
  DefendingPlayer: Player;
  CanRetreat: boolean;
  CanPlaySupporter: boolean;

  constructor(rules: GameRules, deckInfo1: DeckInfo, deckInfo2: DeckInfo) {
    const deck1 = {
      Cards: parseDeck(deckInfo1.Cards),
      EnergyTypes: deckInfo1.EnergyTypes,
    };
    const deck2 = {
      Cards: parseDeck(deckInfo2.Cards),
      EnergyTypes: deckInfo2.EnergyTypes,
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
