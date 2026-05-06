import { allCards } from "@/assets";
import {
  parseEnergy,
  type Energy,
  type InPlayPokemonPredicate,
  type PlayingCardPredicate,
} from "../gamelogic";
import type { ParsedResult } from "./types";

const parsePokemonNames = (text: string): ParsedResult<string[]> => {
  const names = text.split(/, or | or |, and | and |, /);
  let parseSuccessful = true;

  const unknownNames = names.filter((name) => !allCards.some((card) => card.name === name));
  if (unknownNames.length > 0) {
    console.warn(`Unknown Pokémon names in card effect: ${unknownNames.join(", ")}`);
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
  basePredicate: InPlayPokemonPredicate = () => true,
): ParsedResult<InPlayPokemonPredicate> => {
  let predicate: InPlayPokemonPredicate = basePredicate;
  let parseSuccessful = true;

  const parsePart = (
    regex: RegExp,
    transform: (match: RegExpMatchArray) => InPlayPokemonPredicate,
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
  parsePart(/ in play/, () => () => true);

  parsePart(/^Benched /, () => (pokemon) => pokemon.player.BenchedPokemon.includes(pokemon));
  parsePart(
    /^Active | in the Active Spot$/,
    () => (pokemon) => pokemon.player.ActivePokemon === pokemon,
  );

  parsePart(/^Basic /, () => (pokemon) => pokemon.stage === 0);
  parsePart(/^Evolution /, () => (pokemon) => pokemon.stage > 0);
  parsePart(/^Stage 2 /, () => (pokemon) => pokemon.stage === 2);

  parsePart(
    /^evolved /,
    () => (pokemon) => pokemon.inPlayCards.filter((card) => card.cardType === "Pokemon").length > 1,
  );

  const energyTypes: Energy[] = [];
  let energyMatch;
  while ((energyMatch = text.match(/^(?:|and |, and|or |, or |, )\{(\w)\}(?: Pokémon)? */))) {
    const energyType = parseEnergy(energyMatch[1]!);
    energyTypes.push(energyType);
    text = text.slice(energyMatch[0].length);
  }
  if (energyTypes.length > 0) {
    const prevPredicate = predicate;
    predicate = (pokemon) => energyTypes.includes(pokemon.type) && prevPredicate(pokemon);
  }

  parsePart(/ *that has any(?: \{(\w)\})? Energy attached$/, ([, energy]) => {
    const fullEnergy = energy ? parseEnergy(energy) : undefined;
    return (pokemon) => pokemon.hasAnyEnergy(fullEnergy);
  });
  parsePart(/ *that has (\d+) or more(?: \{(\w)\})? Energy attached$/, ([, count, energy]) => {
    const fullEnergy = energy ? parseEnergy(energy) : undefined;
    return (pokemon) => pokemon.getEnergy(fullEnergy).length >= +count!;
  });
  parsePart(/ *that ha(?:s|ve) damage on (?:it|them)$/, () => (pokemon) => pokemon.isDamaged());
  parsePart(/ *that has an Ability$/, () => (pokemon) => pokemon.ability != undefined);
  parsePart(/, except any (.+),/, ([_, descriptor]) => {
    const { parseSuccessful: ps, value: exceptPredicate } = parsePokemonPredicate(descriptor!);
    if (!ps) parseSuccessful = false;
    return (pokemon) => !exceptPredicate(pokemon);
  });

  parsePart(/^Mega Evolution /, () => (pokemon) => pokemon.name.startsWith("Mega "));
  parsePart(/^Pokémon ex$/, () => (pokemon) => pokemon.name.endsWith(" ex"));
  parsePart(/^Ultra Beasts?$/, () => (pokemon) => pokemon.isUltraBeast);

  parsePart(/^Pokémon that evolves? from (.+)/, ([, namesText]) => {
    const { parseSuccessful: ps, value: names } = parsePokemonNames(namesText!);
    if (!ps) parseSuccessful = false;
    return (pokemon) =>
      pokemon.baseCard.evolvesFrom != undefined && names.includes(pokemon.baseCard.evolvesFrom);
  });

  parsePart(/^Poisoned$/, () => (pokemon) => pokemon.isPoisoned());
  parsePart(/^Burned$/, () => (pokemon) => pokemon.isBurned());
  parsePart(/^Asleep$/, () => (pokemon) => pokemon.primaryCondition === "Asleep");
  parsePart(/^Paralyzed$/, () => (pokemon) => pokemon.primaryCondition === "Paralyzed");
  parsePart(/^Confused$/, () => (pokemon) => pokemon.primaryCondition === "Confused");

  if (text === "" || text === "Pokémon") {
    return {
      parseSuccessful: true,
      value: predicate,
    };
  }

  const { parseSuccessful: ps, value: names } = parsePokemonNames(text);
  if (!ps) parseSuccessful = false;
  return {
    parseSuccessful,
    value: (pokemon) => names.includes(pokemon.name) && predicate(pokemon),
  };
};

/**
 * Parses a predicate for selecting playing cards based on a text description.
 * @param text The card text to parse (e.g. "Basic {R} Pokémon", "Pikachu or Charizard")
 * @returns A function that tests whether a given card matches the parsed criteria
 */
export const parsePlayingCardPredicate = (
  text: string,
  basePredicate: PlayingCardPredicate = () => true,
): ParsedResult<PlayingCardPredicate> => {
  let predicate: PlayingCardPredicate = basePredicate;
  let parseSuccessful = true;

  const parsePart = (
    regex: RegExp,
    transform: (match: RegExpMatchArray) => PlayingCardPredicate,
  ) => {
    const match = text.match(regex);
    if (match) {
      const prevPredicate = predicate;
      const newPredicate = transform(match);
      predicate = (card) => newPredicate(card) && prevPredicate(card);
      text = text.replace(regex, "");
    }
  };

  parsePart(/^Basic /, () => (card) => card.cardType === "Pokemon" && card.stage === 0);
  parsePart(/^Stage 1 /, () => (card) => card.cardType === "Pokemon" && card.stage === 1);

  parsePart(/^\{(\w)\} /, ([, energy]) => {
    const energyType = parseEnergy(energy!);
    return (card) => card.cardType === "Pokemon" && card.type === energyType;
  });

  parsePart(/^card that evolves from (.+)$/, ([, namesText]) => {
    const { parseSuccessful: ps, value: names } = parsePokemonNames(namesText!);
    if (!ps) parseSuccessful = false;
    return (card) =>
      card.cardType === "Pokemon" &&
      card.evolvesFrom !== undefined &&
      names.includes(card.evolvesFrom);
  });

  parsePart(
    /^Mega Evolution Pokémon ex$/,
    () => (card) => card.cardType === "Pokemon" && /^Mega .+ ex$/.test(card.name),
  );

  if (text.endsWith(" cards")) text = text.slice(0, -1);

  parsePart(/^Pokémon$/, () => (card) => card.cardType === "Pokemon");
  parsePart(/^Trainer card$/, () => (card) => card.cardType !== "Pokemon");
  parsePart(/^Item card$/, () => (card) => card.cardType === "Item" || card.cardType === "Fossil");
  parsePart(/^Supporter card$/, () => (card) => card.cardType === "Supporter");
  parsePart(/^Pokémon Tool card$/, () => (card) => card.cardType === "PokemonTool");
  parsePart(/^Stadium card$/, () => (card) => card.cardType === "Stadium");

  if (text === "card" || text === "") {
    return {
      parseSuccessful,
      value: predicate,
    };
  }

  const { parseSuccessful: ps, value: names } = parsePokemonNames(text);
  return {
    parseSuccessful: parseSuccessful && ps,
    value: (card) => names.includes(card.name) && predicate(card),
  };
};
