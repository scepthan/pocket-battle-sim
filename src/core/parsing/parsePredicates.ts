import { allCards } from "@/assets";
import { parseEnergy, type Energy, type InPlayPokemonCard, type PlayingCard } from "../gamelogic";

export type Predicate<T> = (obj: T) => boolean;
export type InPlayPokemonPredicate = Predicate<InPlayPokemonCard>;
export type PlayingCardPredicate = Predicate<PlayingCard>;

const parsePokemonNames = (text: string): string[] => {
  const names = text.split(/, or | or |, and | and |, /);

  const unknownNames = names.filter((name) => !allCards.some((card) => card.name === name));
  if (unknownNames.length > 0) {
    console.error(`Unknown Pokémon names in card effect: ${unknownNames.join(", ")}`);
  }

  return names;
};

/**
 * Parses a predicate for selecting Pokémon in play based on a text description.
 * @param text The card text to parse (e.g. "Basic {R} Pokémon", "Benched Pikachu or Charizard")
 * @param basePredicate Extra criteria to check for along with any parsed criteria
 * @returns A function that tests whether a given Pokémon matches the parsed and given criteria
 */
export const parsePokemonPredicate = (
  text: string,
  basePredicate: InPlayPokemonPredicate = () => true
): InPlayPokemonPredicate => {
  let predicate: InPlayPokemonPredicate = basePredicate;

  if (text.startsWith("Benched ")) {
    predicate = (pokemon) => pokemon.player.BenchedPokemon.includes(pokemon);
    text = text.slice(8);
  } else if (text.startsWith("Active ")) {
    predicate = (pokemon) => pokemon.player.ActivePokemon === pokemon;
    text = text.slice(7);
  }

  if (text.startsWith("Basic ")) {
    const prevPredicate = predicate;
    predicate = (pokemon) => pokemon.Stage === 0 && prevPredicate(pokemon);
    text = text.slice(6);
  }

  const energyTypes: Energy[] = [];
  let energyMatch;
  while ((energyMatch = text.match(/^(?:|or |, or |, )\{(\w)\} */))) {
    const energyType = parseEnergy(energyMatch[1]!);
    energyTypes.push(energyType);
    text = text.slice(energyMatch[0].length);
  }
  if (energyTypes.length > 0) {
    const prevPredicate = predicate;
    predicate = (pokemon) => energyTypes.includes(pokemon.Type) && prevPredicate(pokemon);
  }

  if (text.endsWith(" that has any Energy attached")) {
    const prevPredicate = predicate;
    predicate = (pokemon) => pokemon.AttachedEnergy.length > 0 && prevPredicate(pokemon);
    text = text.slice(0, -29);
  }

  if (text === "Pokémon ex") {
    return (pokemon) => pokemon.Name.endsWith(" ex") && predicate(pokemon);
  }
  if (text === "Pokémon") {
    return predicate;
  }

  const names = parsePokemonNames(text);
  return (pokemon) => names.includes(pokemon.Name) && predicate(pokemon);
};

/**
 * Parses a predicate for selecting playing cards based on a text description.
 * @param text The card text to parse (e.g. "Basic {R} Pokémon", "Pikachu or Charizard")
 * @returns A function that tests whether a given card matches the parsed criteria
 */
export const parsePlayingCardPredicate = (
  text: string,
  basePredicate: PlayingCardPredicate = () => true
): PlayingCardPredicate => {
  let predicate: PlayingCardPredicate = basePredicate;

  if (text.startsWith("Basic ")) {
    const prevPredicate = predicate;
    predicate = (card) => card.CardType === "Pokemon" && card.Stage === 0 && prevPredicate(card);
    text = text.slice(6);
  }

  const energyMatch = text.match(/^\{(\w)\} /);
  if (energyMatch) {
    const energyType = parseEnergy(energyMatch[1]!);
    const prevPredicate = predicate;
    predicate = (card) =>
      card.CardType === "Pokemon" && card.Type == energyType && prevPredicate(card);
    text = text.slice(energyMatch[0].length);
  }

  if (text === "Pokémon") {
    return (card: PlayingCard) => card.CardType == "Pokemon" && predicate(card);
  }

  const names = parsePokemonNames(text);
  return (card: PlayingCard) => names.includes(card.Name) && predicate(card);
};
