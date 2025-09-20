import { allCards } from "@/assets";
import type { InPlayPokemonCard, PlayingCard } from "../gamelogic";

export type Predicate<T> = (obj: T) => boolean;
export type InPlayPokemonPredicate = Predicate<InPlayPokemonCard>;
export type PlayingCardPredicate = Predicate<PlayingCard>;

const parsePokemonNames = (text: string): string[] => {
  const names = text.split(/, or | or |, /);

  const unknownNames = names.filter((name) => !allCards.some((card) => card.name === name));
  if (unknownNames.length > 0) {
    throw new Error(`Unknown Pokémon names in card effect: ${unknownNames.join(", ")}`);
  }

  return names;
};

export const parsePokemonPredicate = (text: string): InPlayPokemonPredicate => {
  if (text === "Pokémon") {
    return () => true;
  }
  if (text === "Basic Pokémon") {
    return (pokemon: InPlayPokemonCard) => pokemon.Stage === 0;
  }

  const names = parsePokemonNames(text);
  return (pokemon: InPlayPokemonCard) => names.includes(pokemon.Name);
};

export const parsePlayingCardPredicate = (text: string): PlayingCardPredicate => {
  if (text === "Basic Pokémon") {
    return (card: PlayingCard) => card.CardType == "Pokemon" && card.Stage === 0;
  }

  const names = parsePokemonNames(text);
  return (card: PlayingCard) => names.includes(card.Name);
};
