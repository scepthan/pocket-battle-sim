import type { GameRulePlayerStatus } from "./GameRulePlayerStatus";
import type { PokemonPlayerStatus } from "./PokemonPlayerStatus";

export interface BasePlayerStatus {
  id?: string;
  source: "Effect" | "Ability";
  keepNextTurn?: boolean;
  doesNotStack?: boolean;
}

export type PlayerStatus = GameRulePlayerStatus | PokemonPlayerStatus;
