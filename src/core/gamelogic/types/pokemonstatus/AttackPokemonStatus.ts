import type { PokemonConditional } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

interface BaseAttackPokemonStatus extends BasePokemonStatus {
  defenderCondition?: {
    test: PokemonConditional;
    descriptor: string;
  };
}

// Statuses that affect outgoing attacks
interface ReduceOwnAttackDamagePokemonStatus extends BaseAttackPokemonStatus {
  type: "ReduceOwnAttackDamage";
  amount: number;
}
interface IncreaseAttackPokemonStatus extends BaseAttackPokemonStatus {
  type: "IncreaseAttack";
  amount: number;
}
interface IncreaseDamageOfAttackPokemonStatus extends BaseAttackPokemonStatus {
  type: "IncreaseDamageOfAttack";
  attackName: string;
  amount: number;
}

export type AttackPokemonStatus =
  | ReduceOwnAttackDamagePokemonStatus
  | IncreaseAttackPokemonStatus
  | IncreaseDamageOfAttackPokemonStatus;
