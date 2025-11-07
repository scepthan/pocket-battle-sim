import type { PokemonConditional } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

// Statuses that affect incoming attacks
interface BaseDefensePokemonStatus extends BasePokemonStatus {
  attackerCondition?: {
    test: PokemonConditional;
    descriptor: string;
  };
}

interface ReduceAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "ReduceAttackDamage";
  amount: number;
}
interface PreventAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackDamage";
}
interface PreventAttackEffectsPokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackEffects";
}
interface PreventAttackDamageAndEffectsPokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackDamageAndEffects";
}
interface CounterAttackPokemonStatus extends BaseDefensePokemonStatus {
  type: "CounterAttack";
  amount: number;
}

export type DefensePokemonStatus =
  | ReduceAttackDamagePokemonStatus
  | PreventAttackDamagePokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | CounterAttackPokemonStatus;
