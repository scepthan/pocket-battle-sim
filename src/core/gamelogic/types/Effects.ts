import type { CardSlot, Game, InPlayPokemonCard } from "..";

export type BasicEffect = (game: Game) => Promise<void>;
export type PokemonEffect = (game: Game, self: InPlayPokemonCard) => Promise<void>;
export type TargetedPokemonEffect = (
  game: Game,
  self: InPlayPokemonCard,
  target: CardSlot
) => Promise<void>;

export type PokemonCondition = (game: Game, pokemon: InPlayPokemonCard) => boolean;
