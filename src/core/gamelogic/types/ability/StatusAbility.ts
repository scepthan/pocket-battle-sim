import type { PlayerStatus, PokemonStatus } from "..";
import type { BaseAbility } from "./Ability";

interface PlayerStatusAbilityEffect {
  type: "PlayerStatus";
  status: PlayerStatus;
  opponent: boolean;
}
interface PokemonStatusAbilityEffect {
  type: "PokemonStatus";
  status: PokemonStatus;
}
export type StatusAbilityEffect = PlayerStatusAbilityEffect | PokemonStatusAbilityEffect;

export interface StatusAbility extends BaseAbility {
  type: "Status";
  effect: StatusAbilityEffect[];
}
