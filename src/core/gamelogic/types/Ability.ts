import type {
  CardSlot,
  Game,
  InPlayPokemonCard,
  PlayerStatus,
  PokemonCondition,
  PokemonEffect,
  PokemonStatus,
  TargetedPokemonEffect,
} from "..";

export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "AfterAttackDamage"
  | "OnEnterPlay"
  | "OnEnterActive"
  | "OnEnterBench"
  | "OnFirstEnergyAttach"
  | "OnEnergyZoneAttach"
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
interface PlayerStatusEffect {
  type: "PlayerStatus";
  status: PlayerStatus;
  opponent: boolean;
  effect?: undefined;
  undo?: undefined;
}
interface PokemonStatusEffect {
  type: "PokemonStatus";
  status: PokemonStatus;
  effect?: undefined;
  undo?: undefined;
}
type AbilityEffect = TargetedEffect | StandardEffect | PlayerStatusEffect | PokemonStatusEffect;

export interface Ability {
  name: string;
  trigger: AbilityTrigger;
  text: string;
  conditions: PokemonCondition[];
  effect: AbilityEffect;
}
