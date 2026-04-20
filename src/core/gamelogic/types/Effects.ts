import type { Game, InPlayPokemon, Player } from "..";

export type BasicEffect = (game: Game) => Promise<void>;

export type PlayerPokemonConditional = (
  player: Player,
  pokemon: InPlayPokemon,
  amount: number,
) => boolean;
