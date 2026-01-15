import type { Game, InPlayPokemon, Player } from "..";

export type BasicEffect = (game: Game) => Promise<void>;
export type PokemonEffect = (game: Game, self: InPlayPokemon) => Promise<void>;
export type TargetedPokemonEffect = (
  game: Game,
  self: InPlayPokemon,
  target: InPlayPokemon
) => Promise<void>;

export type NumberOrCalculation =
  | number
  | {
      calc: (pokemon: InPlayPokemon) => number;
      descriptor: string;
    };

export type PokemonConditional = (pokemon: InPlayPokemon) => boolean;
export type PlayerPokemonConditional = (player: Player, pokemon: InPlayPokemon) => boolean;
export interface PokemonDescriptor {
  test: PokemonConditional;
  descriptor: string;
}
