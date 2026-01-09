import type { Energy } from "../Energy";
import type { BasePokemonStatus } from "./PokemonStatus";

// Other statuses
interface ModifyAttackCostPokemonStatus extends BasePokemonStatus {
  type: "ModifyAttackCost";
  energyType: Energy;
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
interface IncreasePoisonDamagePokemonStatus extends BasePokemonStatus {
  type: "IncreasePoisonDamage";
  amount: number;
}

interface CannotEvolvePokemonStatus extends BasePokemonStatus {
  type: "CannotEvolve";
}
interface CannotAttachFromEnergyZonePokemonStatus extends BasePokemonStatus {
  type: "CannotAttachFromEnergyZone";
}

export type OtherPokemonStatus =
  | ModifyAttackCostPokemonStatus
  | CoinFlipToAttackPokemonStatus
  | CannotUseSpecificAttackPokemonStatus
  | CannotAttackPokemonStatus
  | CannotRetreatPokemonStatus
  | NoRetreatCostPokemonStatus
  | ModifyRetreatCostPokemonStatus
  | DoubleEnergyPokemonStatus
  | IncreaseMaxHPPokemonStatus
  | PreventSpecialConditionsPokemonStatus
  | IncreasePoisonDamagePokemonStatus
  | CannotEvolvePokemonStatus
  | CannotAttachFromEnergyZonePokemonStatus;

const source = "Effect";
export const OtherPokemonStatus = {
  ModifyAttackCost: (energyType: Energy, amount: number, turnsToKeep?: number) => ({
    type: "ModifyAttackCost",
    source,
    turnsToKeep,
    energyType,
    amount,
  }),
  CoinFlipToAttack: (turnsToKeep?: number) => ({ type: "CoinFlipToAttack", source, turnsToKeep }),
  CannotUseSpecificAttack: (attackName: string, turnsToKeep?: number) => ({
    type: "CannotUseSpecificAttack",
    source,
    turnsToKeep,
    attackName,
  }),
  CannotAttack: (turnsToKeep?: number) => ({ type: "CannotAttack", source, turnsToKeep }),
  CannotRetreat: (turnsToKeep?: number) => ({ type: "CannotRetreat", source, turnsToKeep }),
  NoRetreatCost: (turnsToKeep?: number) => ({ type: "NoRetreatCost", source, turnsToKeep }),
  ModifyRetreatCost: (amount: number, turnsToKeep?: number) => ({
    type: "ModifyRetreatCost",
    source,
    turnsToKeep,
    amount,
  }),
  DoubleEnergy: (energyType: Energy, turnsToKeep?: number) => ({
    type: "DoubleEnergy",
    source,
    turnsToKeep,
    energyType,
  }),
  IncreaseMaxHP: (amount: number, turnsToKeep?: number) => ({
    type: "IncreaseMaxHP",
    source,
    turnsToKeep,
    amount,
  }),
  PreventSpecialConditions: (turnsToKeep?: number) => ({
    type: "PreventSpecialConditions",
    source,
    turnsToKeep,
  }),
  IncreasePoisonDamage: (amount: number, turnsToKeep?: number) => ({
    type: "IncreasePoisonDamage",
    source,
    turnsToKeep,
    amount,
  }),
  CannotEvolve: (turnsToKeep?: number) => ({ type: "CannotEvolve", source, turnsToKeep }),
  CannotAttachFromEnergyZone: (turnsToKeep?: number) => ({
    type: "CannotAttachFromEnergyZone",
    source,
    turnsToKeep,
  }),
} satisfies Record<string, (...args: never) => OtherPokemonStatus>;
