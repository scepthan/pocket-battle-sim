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

export type OtherPokemonStatus =
  | CannotRetreatPokemonStatus
  | NoRetreatCostPokemonStatus
  | IncreaseMaxHPPokemonStatus;
