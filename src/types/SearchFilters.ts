import type { Energy } from "@/core";

export interface SearchFilters {
  isPokemon: boolean | null;
  type: Energy[];
  stage: number[];
  isEx: boolean | null;
  isMega: boolean | null;
  isUltraBeast: boolean | null;
  hasAbility: boolean | null;
  weakness: Energy[];
  retreatCost: number[];
  hpMin: number | null;
  hpMax: number | null;
  trainerType: string[];
  rarity: string[];
  expansion: string[];
  isPromo: boolean | null;
}
