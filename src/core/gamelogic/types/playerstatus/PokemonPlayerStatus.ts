import type { Game, InPlayPokemon, PokemonStatus } from "@/core";
import type { BasePlayerStatus } from "./PlayerStatus";

export interface PokemonPlayerStatus extends BasePlayerStatus {
  type: "PokemonStatus";
  appliesToPokemon: (pokemon: InPlayPokemon, game: Game) => boolean;
  descriptor?: string;
  pokemonStatus: PokemonStatus;
}
