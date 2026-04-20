import type { InPlayPokemon } from "../InPlayPokemon";
import type { PlayingCard } from "./PlayingCard";

export type Predicate<T> = (obj: T) => boolean;
export type InPlayPokemonPredicate = Predicate<InPlayPokemon>;
export type PlayingCardPredicate = Predicate<PlayingCard>;

export interface PokemonDescriptor {
  test: InPlayPokemonPredicate;
  descriptor: string;
}

export interface PlayingCardDescriptor {
  test: PlayingCardPredicate;
  descriptor: string;
}

interface PokemonCalculation {
  calc: (pokemon: InPlayPokemon) => number;
  descriptor: string;
}
export type NumberOrCalculation = number | PokemonCalculation;
