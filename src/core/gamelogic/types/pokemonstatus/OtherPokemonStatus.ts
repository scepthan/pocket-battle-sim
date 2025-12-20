import type { Energy } from "../Energy";
import type { BasePokemonStatus } from "./PokemonStatus";

// Other statuses
interface CoinFlipToAttackPokemonStatus extends BasePokemonStatus {
  type: "CoinFlipToAttack";
}
interface ModifyAttackCostPokemonStatus extends BasePokemonStatus {
  type: "ModifyAttackCost";
  energyType: Energy;
  amount: number;
}
interface CannotUseSpecificAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotUseSpecificAttack";
  attackName: string;
}
interface CannotAttackPokemonStatus extends BasePokemonStatus {
  type: "CannotAttack";
}

interface CannotRetreatPokemonStatus extends BasePokemonStatus {
  type: "CannotRetreat";
}
interface NoRetreatCostPokemonStatus extends BasePokemonStatus {
  type: "NoRetreatCost";
}
interface ModifyRetreatCostPokemonStatus extends BasePokemonStatus {
  type: "ModifyRetreatCost";
  amount: number;
}

interface DoubleEnergyPokemonStatus extends BasePokemonStatus {
  type: "DoubleEnergy";
  energyType: Energy;
}
interface IncreaseMaxHPPokemonStatus extends BasePokemonStatus {
  type: "IncreaseMaxHP";
  amount: number;
}

interface PreventSpecialConditionsPokemonStatus extends BasePokemonStatus {
  type: "PreventSpecialConditions";
}
interface CannotEvolvePokemonStatus extends BasePokemonStatus {
  type: "CannotEvolve";
}
interface CannotAttachFromEnergyZoneStatus extends BasePokemonStatus {
  type: "CannotAttachFromEnergyZone";
}

export type OtherPokemonStatus =
  | CannotRetreatPokemonStatus
  | NoRetreatCostPokemonStatus
  | ModifyRetreatCostPokemonStatus
  | DoubleEnergyPokemonStatus
  | IncreaseMaxHPPokemonStatus
  | ModifyAttackCostPokemonStatus
  | PreventSpecialConditionsPokemonStatus
  | CannotEvolvePokemonStatus
  | CoinFlipToAttackPokemonStatus
  | CannotUseSpecificAttackPokemonStatus
  | CannotAttackPokemonStatus
  | CannotAttachFromEnergyZoneStatus;
