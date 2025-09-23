interface BasePokemonStatus {
  source: "Effect" | "Ability" | "PokemonTool";
  condition: "Active" | "Benched" | "none";
  keepNextTurn?: boolean;
}
export interface CannotAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotAttack";
}
export interface CannotRetreatPokemonStatus extends BasePokemonStatus {
  type: "CannotRetreat";
}
export interface ReduceDamagePokemonStatus extends BasePokemonStatus {
  type: "ReduceDamage";
  amount: number;
}
export interface PreventAttackDamagePokemonStatus extends BasePokemonStatus {
  type: "PreventAttackDamage";
}
export interface PreventAttackEffectsPokemonStatus extends BasePokemonStatus {
  type: "PreventAttackEffects";
}
export interface PreventAttackDamageAndEffectsPokemonStatus extends BasePokemonStatus {
  type: "PreventAttackDamageAndEffects";
}
export interface ReduceAttackPokemonStatus extends BasePokemonStatus {
  type: "ReduceAttack";
  amount: number;
}
export interface CounterAttackPokemonStatus extends BasePokemonStatus {
  type: "CounterAttack";
  amount: number;
}
export interface CoinFlipToAttackPokemonStatus extends BasePokemonStatus {
  type: "CoinFlipToAttack";
}
export interface IncreaseMaxHPPokemonStatus extends BasePokemonStatus {
  type: "IncreaseMaxHP";
  amount: number;
}

export type PokemonStatus =
  | CannotAttackPokemonStatus
  | CannotRetreatPokemonStatus
  | ReduceDamagePokemonStatus
  | PreventAttackDamagePokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | ReduceAttackPokemonStatus
  | CounterAttackPokemonStatus
  | CoinFlipToAttackPokemonStatus
  | IncreaseMaxHPPokemonStatus;
