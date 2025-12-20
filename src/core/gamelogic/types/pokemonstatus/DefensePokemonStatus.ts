import type { PokemonDescriptor } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

// Statuses that affect incoming attacks
interface BaseDefensePokemonStatus extends BasePokemonStatus {
  attackerCondition?: PokemonDescriptor;
}

interface ModifyIncomingAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "ModifyIncomingAttackDamage";
  amount: number;
}
interface ModifyIncomingAttackDamageOnCoinFlipPokemonStatus extends BaseDefensePokemonStatus {
  type: "ModifyIncomingAttackDamageOnCoinFlip";
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
  | ModifyIncomingAttackDamagePokemonStatus
  | ModifyIncomingAttackDamageOnCoinFlipPokemonStatus
  | PreventAttackDamagePokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | CounterAttackPokemonStatus;
