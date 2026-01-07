import type { PlayerPokemonConditional } from "../Effects";
import type { StandardAbility } from "./StandardAbility";
import type { StatusAbility } from "./StatusAbility";

export interface BaseAbility {
  name: string;
  text: string;
  conditions: PlayerPokemonConditional[];
}

export type Ability = StandardAbility | StatusAbility;
