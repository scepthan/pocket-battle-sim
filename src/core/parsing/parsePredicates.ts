import { allCards } from "@/assets";
import { parseEnergy, type Energy, type InPlayPokemon, type PlayingCard } from "../gamelogic";
import type { ParsedResult } from "./types";

export type Predicate<T> = (obj: T) => boolean;
export type InPlayPokemonPredicate = Predicate<InPlayPokemon>;
export type PlayingCardPredicate = Predicate<PlayingCard>;

const parsePokemonNames = (text: string): ParsedResult<string[]> => {
  const names = text.split(/, or | or |, and | and |, /);
  let parseSuccessful = true;

  const unknownNames = names.filter((name) => !allCards.some((card) => card.name === name));
  if (unknownNames.length > 0) {
    console.error(`Unknown Pokémon names in card effect: ${unknownNames.join(", ")}`);
    parseSuccessful = false;
  }

  return { parseSuccessful, value: names };
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
): ParsedResult<InPlayPokemonPredicate> => {
  let predicate: InPlayPokemonPredicate = basePredicate;

  const parsePart = (
    regex: RegExp,
    transform: (match: RegExpMatchArray) => InPlayPokemonPredicate
  ) => {
    const match = text.match(regex);
    if (match) {
      const prevPredicate = predicate;
      const newPredicate = transform(match);
      predicate = (pokemon) => newPredicate(pokemon) && prevPredicate(pokemon);
      text = text.replace(regex, "");
    }
  };

  parsePart(/^the /, () => () => true);

  parsePart(/^Benched /, () => (pokemon) => pokemon.player.BenchedPokemon.includes(pokemon));
  parsePart(
    /^Active | in the Active Spot$/,
    () => (pokemon) => pokemon.player.ActivePokemon === pokemon
  );

  parsePart(/^Basic /, () => (pokemon) => pokemon.Stage === 0);
  parsePart(/^Stage 2 /, () => (pokemon) => pokemon.Stage === 2);

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

  parsePart(/ that has any(?: {(\w)})? Energy attached$/, ([, energy]) => {
    if (energy) {
      const fullEnergy = parseEnergy(energy);
      return (pokemon) => pokemon.AttachedEnergy.some((e) => e === fullEnergy);
    } else {
      return (pokemon) => pokemon.AttachedEnergy.length > 0;
    }
  });
  parsePart(/ that ha(?:s|ve) damage on (?:it|them)$/, () => (pokemon) => pokemon.isDamaged());

  parsePart(/^Pokémon ex$/, () => (pokemon) => pokemon.Name.endsWith(" ex"));
  parsePart(/^Ultra Beasts?$/, () => (pokemon) => pokemon.isUltraBeast);

  if (text === "" || text === "Pokémon") {
    return {
      parseSuccessful: true,
      value: predicate,
    };
  }

  const { parseSuccessful, value: names } = parsePokemonNames(text);
  return {
    parseSuccessful,
    value: (pokemon) => names.includes(pokemon.Name) && predicate(pokemon),
  };
};

/**
 * Parses a predicate for selecting playing cards based on a text description.
 * @param text The card text to parse (e.g. "Basic {R} Pokémon", "Pikachu or Charizard")
 * @returns A function that tests whether a given card matches the parsed criteria
 */
export const parsePlayingCardPredicate = (
  text: string,
  basePredicate: PlayingCardPredicate = () => true
): ParsedResult<PlayingCardPredicate> => {
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

  if (text.startsWith("card that evolves from ")) {
    const { parseSuccessful, value: names } = parsePokemonNames(text.slice(23));
    return {
      parseSuccessful,
      value: (card) =>
        card.CardType === "Pokemon" &&
        card.EvolvesFrom != undefined &&
        names.includes(card.EvolvesFrom) &&
        predicate(card),
    };
  }

  if (text.endsWith(" cards")) text = text.slice(0, -1);

  if (text === "Pokémon") {
    return {
      parseSuccessful: true,
      value: (card) => card.CardType == "Pokemon" && predicate(card),
    };
  }
  if (text === "Item card") {
    return {
      parseSuccessful: true,
      value: (card) => (card.CardType == "Item" || card.CardType == "Fossil") && predicate(card),
    };
  }
  if (text === "Supporter card") {
    return {
      parseSuccessful: true,
      value: (card) => card.CardType == "Supporter" && predicate(card),
    };
  }
  if (text === "Pokémon Tool card") {
    return {
      parseSuccessful: true,
      value: (card) => card.CardType == "PokemonTool" && predicate(card),
    };
  }
  if (text === "card") {
    return {
      parseSuccessful: true,
      value: predicate,
    };
  }

  const { parseSuccessful, value: names } = parsePokemonNames(text);
  return {
    parseSuccessful,
    value: (card) => names.includes(card.Name) && predicate(card),
  };
};
