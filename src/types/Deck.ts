import type { Energy, PlayingCard } from "./PlayingCard";

export interface Deck {
  Cards: PlayingCard[];
  EnergyTypes: Energy[];
}
