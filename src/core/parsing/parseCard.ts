import { isEnergy, parseEnergy, type Ability, type Energy, type PlayingCard } from "../gamelogic";
import { parseAbility } from "./parseAbility";
import { parseAttack } from "./parseAttack";
import { parsePokemonToolEffect } from "./parsePokemonToolEffect";
import { parseTrainerEffect } from "./parseTrainerEffect";
import type { InputCard, ParsedResultOptional } from "./types";

export const parseCard = (inputCard: InputCard): ParsedResultOptional<PlayingCard> => {
  let parseSuccessful = true;

  if (inputCard.cardType == "Pokemon") {
    const Attacks = inputCard.attacks.map((attack) => {
      const result = parseAttack(attack);
      if (!result.parseSuccessful) parseSuccessful = false;
      return result.value;
    });

    let Ability: Ability | undefined;
    if (inputCard.ability) {
      const result = parseAbility(inputCard.ability);
      Ability = result.value;
      if (!result.parseSuccessful) parseSuccessful = false;
    }

    let Type: Energy = "Colorless";
    if (isEnergy(inputCard.type)) {
      Type = inputCard.type;
    } else {
      parseSuccessful = false;
    }

    let Weakness: Energy | undefined;
    if (!inputCard.weakness) {
      Weakness = undefined;
    } else if (isEnergy(inputCard.weakness)) {
      Weakness = inputCard.weakness;
    } else {
      parseSuccessful = false;
    }

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
      Rarity: inputCard.rarity,
      CardType: inputCard.cardType,
      Type,
      BaseHP: inputCard.hp,
      Stage: inputCard.stage,
      EvolvesFrom: inputCard.previousEvolution,
      RetreatCost: inputCard.retreatCost,
      Weakness,
      PrizePoints: inputCard.name.endsWith(" ex") ? 2 : 1,
      Attacks,
      Ability,
      isUltraBeast: inputCard.isUltraBeast,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "Item" || inputCard.cardType == "Supporter") {
    const result = parseTrainerEffect(inputCard.text);
    if (!result.parseSuccessful) parseSuccessful = false;

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
      Rarity: inputCard.rarity,
      CardType: inputCard.cardType,
      Text: inputCard.text,
      Effect: result.value,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "Fossil") {
    const result = inputCard.text.match(/(\d+)-HP Basic \{(\w)\} Pokémon/i);
    if (!result) parseSuccessful = false;

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
      Rarity: inputCard.rarity,
      CardType: inputCard.cardType,
      Text: inputCard.text,
      BaseHP: result ? parseInt(result[1]!) : 40,
      Type: result ? parseEnergy(result[2]!) : "Colorless",
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "PokemonTool") {
    const result = parsePokemonToolEffect(inputCard.text);
    if (!result.parseSuccessful) parseSuccessful = false;

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
      Rarity: inputCard.rarity,
      CardType: inputCard.cardType,
      Text: inputCard.text,
      Effect: result.value,
    };

    return { value: outputCard, parseSuccessful };
  } else {
    // Would only happen if a card is defined with an invalid CardType
    return { value: undefined, parseSuccessful: false };
  }
};
