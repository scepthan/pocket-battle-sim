import type { Energy, Game, InPlayPokemonCard } from "@/core";
import type { BasePlayerStatus } from "./PlayerStatus";

interface BasePokemonPlayerStatus extends BasePlayerStatus {
  category: "Pokemon";
  appliesToPokemon: (pokemon: InPlayPokemonCard, game: Game) => boolean;
  descriptor?: string;
}

interface IncreaseAttackPlayerStatus extends BasePokemonPlayerStatus {
  type: "IncreaseAttack";
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
interface CannotEvolvePlayerStatus extends BasePokemonPlayerStatus {
  type: "CannotEvolve";
}
interface DoubleEnergyPlayerStatus extends BasePokemonPlayerStatus {
  type: "DoubleEnergy";
  energyType: Energy;
  doesNotStack: true;
}

export type PokemonPlayerStatus =
  | IncreaseAttackPlayerStatus
  | IncreaseDefensePlayerStatus
  | DecreaseRetreatCostPlayerStatus
  | CannotEvolvePlayerStatus
  | DoubleEnergyPlayerStatus;
