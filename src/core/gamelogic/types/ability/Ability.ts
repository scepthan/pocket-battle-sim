import type { PokemonConditional } from "@/core";
import type { StandardAbility } from "./StandardAbility";
import type { StatusAbility } from "./StatusAbility";

export interface BaseAbility {
  name: string;
  text: string;
  conditions: PokemonConditional[];
}

export type Ability = StandardAbility | StatusAbility;
