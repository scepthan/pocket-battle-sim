import type { CardSlot, Game, InPlayPokemonCard } from "..";

export type AbilityEffect = (game: Game, self: InPlayPokemonCard) => Promise<void>;
export type TargetedAbilityEffect = (
  game: Game,
  self: InPlayPokemonCard,
  target: CardSlot
) => Promise<void>;
export type AbilityCondition = (game: Game, self: InPlayPokemonCard) => boolean;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "AfterAttackDamage"
  | "OnEnterPlay"
  | "OnEnterActive"
  | "OnEnterBench"
  | "GameRule";

interface TargetedEffect {
  type: "Targeted";
  findValidTargets: (game: Game, self: InPlayPokemonCard) => CardSlot[];
  effect: TargetedAbilityEffect;
  undo?: undefined;
}
interface StandardEffect {
  type: "Standard";
  effect: AbilityEffect;
  undo?: AbilityEffect;
}
export interface Ability {
  name: string;
  trigger: AbilityTrigger;
  text: string;
  conditions: AbilityCondition[];
  effect: TargetedEffect | StandardEffect;
}
