import type { Game } from "../Game";
import type { InPlayPokemonCard } from "../InPlayPokemonCard";
import type { Energy } from "./Energy";

interface BasePlayerStatus {
  source: "Effect" | "Ability";
  keepNextTurn?: boolean;
  doesNotStack?: boolean;
}

interface GameRulePlayerStatus extends BasePlayerStatus {
  category: "GameRule";
}
interface CannotUseSupporterPlayerStatus extends GameRulePlayerStatus {
  type: "CannotUseSupporter";
}
interface CannotUseItemPlayerStatus extends GameRulePlayerStatus {
  type: "CannotUseItem";
}

interface PokemonPlayerStatus extends BasePlayerStatus {
  category: "Pokemon";
  appliesToPokemon: (pokemon: InPlayPokemonCard, game: Game) => boolean;
  descriptor?: string;
}
interface IncreaseAttackPlayerStatus extends PokemonPlayerStatus {
  type: "IncreaseAttack";
  amount: number;
}
interface IncreaseDefensePlayerStatus extends PokemonPlayerStatus {
  type: "IncreaseDefense";
  amount: number;
}
interface DecreaseRetreatCostPlayerStatus extends PokemonPlayerStatus {
  type: "DecreaseRetreatCost";
  amount: number;
}
interface CannotEvolvePlayerStatus extends PokemonPlayerStatus {
  type: "CannotEvolve";
}
interface DoubleEnergyPlayerStatus extends PokemonPlayerStatus {
  type: "DoubleEnergy";
  energyType: Energy;
  doesNotStack: true;
}

export type PlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | IncreaseAttackPlayerStatus
  | IncreaseDefensePlayerStatus
  | DecreaseRetreatCostPlayerStatus
  | CannotEvolvePlayerStatus
  | DoubleEnergyPlayerStatus;
