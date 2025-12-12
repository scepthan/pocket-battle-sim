import type { CardSlot, Game, InPlayPokemon } from "..";

export type BasicEffect = (game: Game) => Promise<void>;
export type PokemonEffect = (game: Game, self: InPlayPokemon) => Promise<void>;
export type TargetedPokemonEffect = (
  game: Game,
  self: InPlayPokemon,
  target: CardSlot
) => Promise<void>;

export type PokemonConditional = (pokemon: InPlayPokemon) => boolean;
