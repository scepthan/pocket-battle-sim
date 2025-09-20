import { isEnergy, type Ability, type Energy, type PlayingCard } from "../gamelogic";
import { parseAbility } from "./parseAbility";
import { parseAttack } from "./parseAttack";
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

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
      CardType: inputCard.cardType,
      Type,
      BaseHP: inputCard.hp,
      Stage: inputCard.stage,
      EvolvesFrom: inputCard.previousEvolution,
      RetreatCost: inputCard.retreatCost,
      Weakness: inputCard.weakness,
      PrizePoints: inputCard.name.endsWith(" ex") ? 2 : 1,
      Attacks,
      Ability,
    };

    return { value: outputCard, parseSuccessful };
  } else if (
    inputCard.cardType == "Item" ||
    inputCard.cardType == "Fossil" ||
    inputCard.cardType == "Supporter"
  ) {
    const result = parseTrainerEffect(inputCard.text);
    if (!result.parseSuccessful) parseSuccessful = false;

    const outputCard = {
      ID: inputCard.id,
      Name: inputCard.name,
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
