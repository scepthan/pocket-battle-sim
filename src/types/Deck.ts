import type { Energy, PlayingCard } from "./PlayingCard.js";

export interface Deck {
  Cards: PlayingCard[];
  EnergyTypes: Energy[];
}
