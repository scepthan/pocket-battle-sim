import {
  isEnergy,
  parseEnergy,
  type Ability,
  type Energy,
  type FossilCard,
  type ItemCard,
  type PlayingCard,
  type PokemonCard,
  type PokemonToolCard,
  type StadiumCard,
  type SupporterCard,
} from "../gamelogic";
import { statusesToSideEffects } from "./EffectParser";
import { parseAbility } from "./parseAbility";
import { parseAttack } from "./parseAttack";
import { parseEffect } from "./parseEffect";
import type { InputCard, ParsedResultOptional } from "./types";

export const parseCard = (inputCard: InputCard): ParsedResultOptional<PlayingCard> => {
  let parseSuccessful = true;

  if (inputCard.cardType == "Pokemon") {
    const attacks = inputCard.attacks.map((attack) => {
      const result = parseAttack(attack);
      if (!result.parseSuccessful) parseSuccessful = false;
      return result.value;
    });

    let ability: Ability | undefined;
    if (inputCard.ability) {
      const result = parseAbility(inputCard.ability, "Ability");
      if (!result.parseSuccessful) parseSuccessful = false;
      ability = result.value;
    }

    let type: Energy = "Colorless";
    if (isEnergy(inputCard.type)) {
      type = inputCard.type;
    } else {
      parseSuccessful = false;
    }

    let weakness: Energy | undefined;
    if (!inputCard.weakness) {
      weakness = undefined;
    } else if (isEnergy(inputCard.weakness)) {
      weakness = inputCard.weakness;
    } else {
      parseSuccessful = false;
    }

    const outputCard: PokemonCard = {
      id: inputCard.id,
      name: inputCard.name,
      rarity: inputCard.rarity,
      cardType: inputCard.cardType,
      type,
      baseHP: inputCard.hp,
      stage: inputCard.stage,
      evolvesFrom: inputCard.previousEvolution,
      retreatCost: inputCard.retreatCost,
      weakness,
      prizePoints: inputCard.name.endsWith(" ex") ? 2 : 1,
      attacks,
      ability,
      isUltraBeast: inputCard.isUltraBeast,
      parseSuccessful,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "Item" || inputCard.cardType == "Supporter") {
    const result = parseEffect(inputCard.text);
    if (!result.parseSuccessful) parseSuccessful = false;
    const effect = result.value;

    const outputCard: ItemCard | SupporterCard = {
      id: inputCard.id,
      name: inputCard.name,
      rarity: inputCard.rarity,
      cardType: inputCard.cardType,
      text: inputCard.text,
      effect: {
        ...(effect.validTargets
          ? {
              type: "Targeted",
              validTargets: effect.validTargets,
            }
          : { type: "Standard" }),
        conditions: [...effect.explicitConditions, ...effect.implicitConditions],
        passedAmount: effect.passedAmount,
        flipCoins: effect.flipCoins,
        sideEffects: [...effect.sideEffects, ...statusesToSideEffects(effect)],
      },
      parseSuccessful,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "Fossil") {
    const result = inputCard.text.match(/(\d+)-HP Basic \{(\w)\} Pokémon/i);
    if (!result) parseSuccessful = false;

    const outputCard: FossilCard = {
      id: inputCard.id,
      name: inputCard.name,
      rarity: inputCard.rarity,
      cardType: inputCard.cardType,
      text: inputCard.text,
      baseHP: result ? parseInt(result[1]!) : 40,
      type: result ? parseEnergy(result[2]!) : "Colorless",
      parseSuccessful,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType == "PokemonTool") {
    const result = parseAbility(
      {
        name: inputCard.name,
        text: inputCard.text,
      },
      "PokemonTool",
    );
    if (!result.parseSuccessful) parseSuccessful = false;

    const outputCard: PokemonToolCard = {
      id: inputCard.id,
      name: inputCard.name,
      rarity: inputCard.rarity,
      cardType: inputCard.cardType,
      text: inputCard.text,
      effect: result.value,
      parseSuccessful,
    };

    return { value: outputCard, parseSuccessful };
  } else if (inputCard.cardType === "Stadium") {
    const result = parseAbility(
      {
        name: inputCard.name,
        text: inputCard.text,
      },
      "Stadium",
    );
    parseSuccessful = false;
    const outputCard: StadiumCard = {
      id: inputCard.id,
      name: inputCard.name,
      rarity: inputCard.rarity,
      cardType: inputCard.cardType,
      text: inputCard.text,
      effect: result.value,
      parseSuccessful,
    };
    return { value: outputCard, parseSuccessful };
  } else {
    // Would only happen if a card is defined with an invalid CardType
    return { value: undefined, parseSuccessful: false };
  }
};
