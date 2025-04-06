import type { GameState } from "@/models/GameState";
import {
  EnergyMap,
  isEnergy,
  isEnergyShort,
  type Ability,
  type Effect,
  type Energy,
  type InputCard,
  type InputCardAbility,
  type InputCardMove,
  type Move,
  type ParsedResult,
  type PlayingCard,
} from "@/types";

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
      const result = parseTrainerEffect(inputCard.Text);
      if (!result.parseSuccessful) parseSuccessful = false;
      else
        console.log(
          "\n\n\n\nCARD PARSED SUCCESSFULLY",
          inputCard.Name,
          result.value
        );

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

  const parseMove = (inputMove: InputCardMove): ParsedResult<Move> => {
    let parseSuccessful = true;
    const Name = inputMove.Name;

    const RequiredEnergy: Energy[] = [];
    for (const E of inputMove.Energy) {
      if (isEnergyShort(E)) RequiredEnergy.push(EnergyMap[E]);
      else parseSuccessful = false;
    }

    const Effect = async (gameState: GameState) => {
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
        Effect: async () => {},
      },
    };
  };

  const parseTrainerEffect = (cardText: string): ParsedResult<Effect> => {
    const dictionary: {
      pattern: RegExp;
      transform: (...args: unknown[]) => Effect;
    }[] = [
      {
        pattern: /^Draw (a|\d+) cards?\.$/,
        transform: (_, count) => async (game: GameState) =>
          game.drawCards(count == "a" ? 1 : Number(count)),
      },
      {
        pattern: /^Put 1 random Basic Pokemon from your deck into your hand\.$/,
        transform: () => async (game: GameState) =>
          game.AttackingPlayer.drawRandomBasic(),
      },
    ];

    for (const { pattern, transform } of dictionary) {
      const result = cardText.match(pattern);

      if (result) {
        return {
          parseSuccessful: true,
          value: transform(...result),
        };
      }
    }

    return {
      parseSuccessful: false,
      value: async () => {},
    };
  };

  return { parseCard, parseMove, parseAbility };
};
