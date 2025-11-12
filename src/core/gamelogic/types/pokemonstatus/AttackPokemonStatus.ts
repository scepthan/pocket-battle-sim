import type { BasePokemonStatus } from "./PokemonStatus";

// Statuses that affect outgoing attacks
interface ReduceOwnAttackDamagePokemonStatus extends BasePokemonStatus {
  type: "ReduceOwnAttackDamage";
  amount: number;
}
interface IncreaseAttackPokemonStatus extends BasePokemonStatus {
  type: "IncreaseAttack";
  amount: number;
}
interface IncreaseDamageOfAttackPokemonStatus extends BasePokemonStatus {
  type: "IncreaseDamageOfAttack";
  attackName: string;
  amount: number;
}
interface CoinFlipToAttackPokemonStatus extends BasePokemonStatus {
  type: "CoinFlipToAttack";
}
interface CannotUseSpecificAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotUseSpecificAttack";
  attackName: string;
}
interface CannotAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotAttack";
}

export type AttackPokemonStatus =
  | ReduceOwnAttackDamagePokemonStatus
  | IncreaseAttackPokemonStatus
  | IncreaseDamageOfAttackPokemonStatus
  | CoinFlipToAttackPokemonStatus
  | CannotUseSpecificAttackPokemonStatus
  | CannotAttackPokemonStatus;
