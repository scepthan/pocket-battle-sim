import type { Energy } from "../Energy";
import type { BasePokemonStatus } from "./PokemonStatus";

// Other statuses
interface CannotRetreatPokemonStatus extends BasePokemonStatus {
  type: "CannotRetreat";
}
interface NoRetreatCostPokemonStatus extends BasePokemonStatus {
  type: "NoRetreatCost";
}
interface IncreaseMaxHPPokemonStatus extends BasePokemonStatus {
  type: "IncreaseMaxHP";
  amount: number;
}
interface ReduceAttackCostPokemonStatus extends BasePokemonStatus {
  type: "ReduceAttackCost";
  energyType: Energy;
  amount: number;
}
interface PreventSpecialConditionsPokemonStatus extends BasePokemonStatus {
  type: "PreventSpecialConditions";
}

export type OtherPokemonStatus =
  | CannotRetreatPokemonStatus
  | NoRetreatCostPokemonStatus
  | IncreaseMaxHPPokemonStatus
  | ReduceAttackCostPokemonStatus
  | PreventSpecialConditionsPokemonStatus;
