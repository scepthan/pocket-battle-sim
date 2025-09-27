import type { PokemonCondition } from "./Effects";

interface BasePokemonStatus {
  id?: string;
  source: "Effect" | "Ability" | "PokemonTool";
  keepNextTurn?: boolean;
}

// Statuses that affect incoming attacks
interface DefensePokemonStatus extends BasePokemonStatus {
  attackerCondition?: {
    test: PokemonCondition;
    descriptor: string;
  };
}
export interface ReduceAttackDamagePokemonStatus extends DefensePokemonStatus {
  type: "ReduceAttackDamage";
  amount: number;
}
export interface PreventAttackDamagePokemonStatus extends DefensePokemonStatus {
  type: "PreventAttackDamage";
}
export interface PreventAttackEffectsPokemonStatus extends DefensePokemonStatus {
  type: "PreventAttackEffects";
}
export interface PreventAttackDamageAndEffectsPokemonStatus extends DefensePokemonStatus {
  type: "PreventAttackDamageAndEffects";
}
export interface CounterAttackPokemonStatus extends DefensePokemonStatus {
  type: "CounterAttack";
  amount: number;
}

// Statuses that affect outgoing attacks
export interface ReduceOwnAttackDamagePokemonStatus extends BasePokemonStatus {
  type: "ReduceOwnAttackDamage";
  amount: number;
}
export interface IncreaseDamageOfAttack extends BasePokemonStatus {
  type: "IncreaseDamageOfAttack";
  attackName: string;
  amount: number;
}
export interface CoinFlipToAttackPokemonStatus extends BasePokemonStatus {
  type: "CoinFlipToAttack";
}
export interface CannotUseSpecificAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotUseSpecificAttack";
  attackName: string;
}
export interface CannotAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotAttack";
}

// Other statuses
export interface CannotRetreatPokemonStatus extends BasePokemonStatus {
  type: "CannotRetreat";
}
export interface NoRetreatCostPokemonStatus extends BasePokemonStatus {
  type: "NoRetreatCost";
}
export interface IncreaseMaxHPPokemonStatus extends BasePokemonStatus {
  type: "IncreaseMaxHP";
  amount: number;
}

export type PokemonStatus =
  | ReduceAttackDamagePokemonStatus
  | PreventAttackDamagePokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | CounterAttackPokemonStatus
  | ReduceOwnAttackDamagePokemonStatus
  | IncreaseDamageOfAttack
  | CoinFlipToAttackPokemonStatus
  | CannotUseSpecificAttackPokemonStatus
  | CannotAttackPokemonStatus
  | CannotRetreatPokemonStatus
  | NoRetreatCostPokemonStatus
  | IncreaseMaxHPPokemonStatus;
