import type { GameState } from "@/models/GameState";
import {
  EnergyMap,
  isEnergy,
  isEnergyShort,
  type Energy,
} from "@/types/Energy";
import type {
  InputCard,
  InputCardAbility,
  InputCardMove,
} from "@/types/InputCard";
import type { ParsedResult } from "@/types/ParsedResult";
import type { PlayingCard, Move, Ability } from "@/types/PlayingCard";

export const useCardParser = () => {
  const parseCard = (
    inputCard: InputCard
  ): ParsedResult<PlayingCard | undefined> => {
    let parseSuccessful = true;

    if (inputCard.CardType == "Pokemon") {
      const Moves = inputCard.Moves.map((move) => {
        const result = parseMove(move);
        if (!result.parseSuccessful) parseSuccessful = false;
        return result.value;
      });

      const outAbility = parseAbility(inputCard.Ability);
      const Ability = outAbility.value;
      if (!outAbility.parseSuccessful) {
        parseSuccessful = false;
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
        Moves,
        Ability,
      };

      return { value: outputCard, parseSuccessful };
    } else if (
      inputCard.CardType == "Item" ||
      inputCard.CardType == "Supporter"
    ) {
      const outputCard = {
        ID: inputCard.ID,
        Name: inputCard.Name,
        CardType: inputCard.CardType,
        Effect: () => {},
      };

      return { value: outputCard, parseSuccessful };
    } else {
      // Would only happen if a card is defined with an invalid CardType
      return { value: undefined, parseSuccessful: false };
    }
  };

  const parseMove = (inputMove: InputCardMove): ParsedResult<Move> => {
    let parseSuccessful = true;
    const Name = inputMove.Name;

    const RequiredEnergy: Energy[] = [];
    for (let E of inputMove.Energy) {
      if (isEnergyShort(E)) RequiredEnergy.push(EnergyMap[E]);
      else parseSuccessful = false;
    }

    const Effect = (gameState: GameState) => {
      gameState.attackActivePokemon(inputMove.HP ?? 0);
    };
    if (inputMove.Effect) parseSuccessful = false;

    return {
      parseSuccessful,
      value: { Name, RequiredEnergy, Effect },
    };
  };

  const parseAbility = (
    inputAbility?: InputCardAbility
  ): ParsedResult<Ability | undefined> => {
    if (!inputAbility) {
      return {
        parseSuccessful: true,
        value: undefined,
      };
    }
    return {
      parseSuccessful: false,
      value: {
        Name: inputAbility.Name,
        Trigger: "GameRule",
        Conditions: [],
        Effect: () => {},
      },
    };
  };

  return { parseCard, parseMove, parseAbility };
};
