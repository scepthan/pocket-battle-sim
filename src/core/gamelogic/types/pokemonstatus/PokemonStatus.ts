import type { AttackPokemonStatus } from "./AttackPokemonStatus";
import type { DefensePokemonStatus } from "./DefensePokemonStatus";
import type { OtherPokemonStatus } from "./OtherPokemonStatus";

export interface BasePokemonStatus {
  id?: string;
  source: "Effect" | "Ability" | "PokemonTool" | "PlayerStatus";
  turnsToKeep?: number;
}

export type PokemonStatus = DefensePokemonStatus | AttackPokemonStatus | OtherPokemonStatus;
