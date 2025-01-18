import type { Energy } from "./Energy";
import type { PlayingCard } from "./PlayingCard";

export interface DeckInfo {
  Cards: PlayingCard[];
  EnergyTypes: Energy[];
}
