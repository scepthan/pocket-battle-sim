import type {
  CardSlot,
  Game,
  InPlayPokemonCard,
  PokemonCondition,
  PokemonEffect,
  TargetedPokemonEffect,
} from "..";

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
  effect: TargetedPokemonEffect;
  undo?: undefined;
}
interface StandardEffect {
  type: "Standard";
  effect: PokemonEffect;
  undo?: PokemonEffect;
}
export interface Ability {
  name: string;
  trigger: AbilityTrigger;
  text: string;
  conditions: PokemonCondition[];
  effect: TargetedEffect | StandardEffect;
}
