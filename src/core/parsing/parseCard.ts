import { type Ability, type Energy, isEnergy, type PlayingCard } from "../types";
import { parseAbility } from "./parseAbility";
import { parseAttack } from "./parseAttack";
import { parseTrainerEffect } from "./parseTrainerEffect";
import type { InputCard, ParsedResultOptional } from "./types";

export const parseCard = (inputCard: InputCard): ParsedResultOptional<PlayingCard> => {
  let parseSuccessful = true;

  if (inputCard.CardType == "Pokemon") {
    const Attacks = inputCard.Moves.map((attack) => {
      const result = parseAttack(attack);
      if (!result.parseSuccessful) parseSuccessful = false;
      return result.value;
    });

    let Ability: Ability | undefined;
    if (inputCard.Ability) {
      const result = parseAbility(inputCard.Ability);
      Ability = result.value;
      if (!result.parseSuccessful) parseSuccessful = false;
    }

    let Type: Energy = "Colorless";
    if (isEnergy(inputCard.Type)) {
      Type = inputCard.Type;
    } else {
      parseSuccessful = false;
    }

    const outputCard = {
      ID: inputCard.ID,
      Name: inputCard.Name,
      CardType: inputCard.CardType,
      Type,
      BaseHP: inputCard.HP,
      Stage: inputCard.Stage,
      EvolvesFrom: inputCard.EvolvesFrom,
      RetreatCost: inputCard.RetreatCost,
      Weakness: inputCard.Weakness,
      PrizePoints: inputCard.Name.endsWith(" ex") ? 2 : 1,
      Attacks,
      Ability,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.CardType == "Item" || inputCard.CardType == "Supporter") {
    const result = parseTrainerEffect(inputCard.Text);
    if (!result.parseSuccessful) parseSuccessful = false;

    const outputCard = {
      ID: inputCard.ID,
      Name: inputCard.Name,
      CardType: inputCard.CardType,
      Effect: result.value,
    };

    return { value: outputCard, parseSuccessful };
  } else {
    // Would only happen if a card is defined with an invalid CardType
    return { value: undefined, parseSuccessful: false };
  }
};
