interface BasePokemonStatus {
  source: "Effect" | "Ability" | "Tool";
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
export interface PreventDamagePokemonStatus extends BasePokemonStatus {
  type: "PreventDamage";
}
export interface ReduceAttackPokemonStatus extends BasePokemonStatus {
  type: "ReduceAttack";
  amount: number;
}
export interface CounterAttackPokemonStatus extends BasePokemonStatus {
  type: "CounterAttack";
  amount: number;
}

export type PokemonStatus =
  | CannotAttackPokemonStatus
  | CannotRetreatPokemonStatus
  | ReduceDamagePokemonStatus
  | PreventDamagePokemonStatus
  | ReduceAttackPokemonStatus
  | CounterAttackPokemonStatus;
