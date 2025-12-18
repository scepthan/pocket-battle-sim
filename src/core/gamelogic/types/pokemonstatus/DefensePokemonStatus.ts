import type { PokemonDescriptor } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

// Statuses that affect incoming attacks
interface BaseDefensePokemonStatus extends BasePokemonStatus {
  attackerCondition?: PokemonDescriptor;
}

interface ReduceAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "ReduceAttackDamage";
  amount: number;
}
interface PreventAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackDamage";
}
interface ReduceAttackDamageOnCoinFlipPokemonStatus extends BaseDefensePokemonStatus {
  type: "ReduceAttackDamageOnCoinFlip";
  amount: number;
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
  | ReduceAttackDamageOnCoinFlipPokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | CounterAttackPokemonStatus;
