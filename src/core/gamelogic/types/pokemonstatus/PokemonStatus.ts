import { AttackPokemonStatus } from "./AttackPokemonStatus";
import { DefensePokemonStatus } from "./DefensePokemonStatus";
import { OtherPokemonStatus } from "./OtherPokemonStatus";

export interface BasePokemonStatus {
  id?: string;
  source: "Effect" | "Ability" | "PokemonTool" | "PlayerStatus";
  turnsToKeep?: number;
}

export type PokemonStatus = DefensePokemonStatus | AttackPokemonStatus | OtherPokemonStatus;
export const PokemonStatus = {
  ...DefensePokemonStatus,
  ...AttackPokemonStatus,
  ...OtherPokemonStatus,
};
