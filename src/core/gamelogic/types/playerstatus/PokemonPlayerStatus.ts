import type { Energy, Game, InPlayPokemon } from "@/core";
import type { BasePlayerStatus } from "./PlayerStatus";

interface BasePokemonPlayerStatus extends BasePlayerStatus {
  category: "Pokemon";
  appliesToPokemon: (pokemon: InPlayPokemon, game: Game) => boolean;
  descriptor?: string;
}

interface IncreaseAttackPlayerStatus extends BasePokemonPlayerStatus {
  type: "IncreaseAttack";
  appliesToDefender?: (pokemon: InPlayPokemon, game: Game) => boolean;
  amount: number;
}
interface IncreaseDefensePlayerStatus extends BasePokemonPlayerStatus {
  type: "IncreaseDefense";
  amount: number;
}
interface DecreaseRetreatCostPlayerStatus extends BasePokemonPlayerStatus {
  type: "DecreaseRetreatCost";
  amount: number;
}
interface NoRetreatCostPlayerStatus extends BasePokemonPlayerStatus {
  type: "NoRetreatCost";
}
interface CannotEvolvePlayerStatus extends BasePokemonPlayerStatus {
  type: "CannotEvolve";
}
interface DoubleEnergyPlayerStatus extends BasePokemonPlayerStatus {
  type: "DoubleEnergy";
  energyType: Energy;
  doesNotStack: true;
}
interface ReduceAttackCostPlayerStatus extends BasePokemonPlayerStatus {
  type: "ReduceAttackCost";
  energyType: Energy;
  amount: number;
}

export type PokemonPlayerStatus =
  | IncreaseAttackPlayerStatus
  | IncreaseDefensePlayerStatus
  | DecreaseRetreatCostPlayerStatus
  | NoRetreatCostPlayerStatus
  | CannotEvolvePlayerStatus
  | DoubleEnergyPlayerStatus
  | ReduceAttackCostPlayerStatus;
