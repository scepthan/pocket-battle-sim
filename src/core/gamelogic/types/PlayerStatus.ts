import type { InPlayPokemonCard } from "../InPlayPokemonCard";

interface BasePlayerStatus {
  source: "Effect" | "Ability";
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
  validPokemon: (pokemon: InPlayPokemonCard) => boolean;
}
interface IncreaseAttackPlayerStatus extends PokemonPlayerStatus {
  type: "IncreaseAttack";
  amount: number;
}

export type PlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | IncreaseAttackPlayerStatus;
