import type { PokemonDescriptor, PokemonStatus } from "@/core";
import type { BasePlayerStatus } from "./PlayerStatus";

export interface PokemonPlayerStatus extends BasePlayerStatus {
  type: "PokemonStatus";
  pokemonCondition: PokemonDescriptor;
  pokemonStatus: PokemonStatus;
}
