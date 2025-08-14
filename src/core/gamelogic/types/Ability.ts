import type { Game, InPlayPokemonCard } from "..";

export type AbilityEffect = (game: Game, pokemon: InPlayPokemonCard) => Promise<void>;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "AfterAttackDamage"
  | "OnEnterPlay"
  | "GameRule";
export type AbilityCondition = "Active" | "OnBench" | "HasDamage";

export interface Ability {
  Name: string;
  Trigger: AbilityTrigger;
  Conditions: AbilityCondition[];
  Text: string;
  Effect: AbilityEffect;
}
