import type { Game } from "../Game";
import type { InPlayPokemonCard } from "../InPlayPokemonCard";

interface BasePlayerStatus {
  source: "Effect" | "Ability";
  keepNextTurn?: boolean;
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

export type PlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | IncreaseAttackPlayerStatus
  | IncreaseDefensePlayerStatus
  | DecreaseRetreatCostPlayerStatus;
