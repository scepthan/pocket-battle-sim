import type { Energy } from "./Energy";
import type { PlayingCard } from "./PlayingCard";

export interface Deck {
  Cards: PlayingCard[];
  EnergyTypes: Energy[];
}
export interface DeckInfo {
  Cards: string[];
  EnergyTypes: Energy[];
}
