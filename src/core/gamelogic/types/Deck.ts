import type { Energy } from "./Energy";
import type { PlayingCard } from "./PlayingCard";

export interface Deck {
  Cards: PlayingCard[];
  EnergyTypes: Energy[];
}
export interface DeckInfo {
  /**
   * List of IDs of all 20 cards included in the deck.
   */
  Cards: string[];

  /**
   * List of Energy types to generate (up to 3).
   */
  EnergyTypes: Energy[];

  /**
   * List of names of cards to highlight on the deck selection screen. If not provided, the
   * highlight cards will be inferred from card names included in the deck name.
   */
  HighlightCards?: string[];

  /**
   * List of reasons why the deck is considered invalid. If empty or not provided, the deck is
   * valid. Used for custom decks only.
   */
  InvalidReasons?: string[];
}
