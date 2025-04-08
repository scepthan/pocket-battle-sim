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

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => Effect;
}

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

    const defaultEffect = async (gameState: GameState) => {
      gameState.attackActivePokemon(inputMove.HP ?? 0);
    };
    if (inputMove.Effect) {
      const dictionary: EffectTransformer[] = [
        {
          pattern: /^Heal (\d+) damage from this Pokémon\.$/,
          transform: (_, HP) => async (game: GameState) => {
            await defaultEffect(game);
            game.healPokemon(game.AttackingPlayer.ActivePokemon!, Number(HP));
          },
        },
        {
          pattern:
            /^If this Pokémon has at least (\d+) extra (?:{(\w)} )?Energy attached, this attack does (\d+) more damage\.$/,
          transform: (_, energyCount, energyType, extraDamage) => {
            const e = EnergyMap[isEnergyShort(energyType) ? energyType : "C"];
            const secondaryRequiredEnergy = [...RequiredEnergy];
            for (let i = 0; i < Number(energyCount); i++)
              secondaryRequiredEnergy.unshift(e);

            return async (game: GameState) => {
              const active = game.AttackingPlayer.ActivePokemon!;
              let damage = inputMove.HP!;
              if (active.hasSufficientEnergy(secondaryRequiredEnergy))
                damage += Number(extraDamage);
              game.attackActivePokemon(damage);
            };
          },
        },
        {
          pattern: /^Draw (a|\d+) cards?\.$/,
          transform: (_, count) => async (game: GameState) => {
            await defaultEffect(game);
            game.drawCards(count == "a" ? 1 : Number(count));
          },
        },
        {
          pattern:
            /^Flip a coin for each (?:{(\w)} )?Energy attached to this Pokémon\. This attack does (\d+) damage for each heads\.$/,
          transform: (_, energyType, damage) => async (game: GameState) => {
            const energy = game.AttackingPlayer.ActivePokemon!.AttachedEnergy;
            const totalFlips = isEnergyShort(energyType)
              ? energy.filter((e) => e == EnergyMap[energyType]).length
              : energy.length;
            const { heads } = game.flipMultiCoin(
              game.AttackingPlayer,
              totalFlips
            );
            game.attackActivePokemon(heads * Number(damage));
          },
        },
        {
          pattern:
            /^This attack does (\d+) more damage for each Energy attached to your opponent's Active Pokémon\.$/,
          transform: (_, extraDamage) => async (game: GameState) => {
            const energyCount =
              game.DefendingPlayer.ActivePokemon!.AttachedEnergy.length;
            const damage = inputMove.HP! + Number(extraDamage) * energyCount;
            game.attackActivePokemon(damage);
          },
        },
        {
          pattern: /^Switch this Pokémon with 1 of your Benched Pokémon\.$/,
          transform: () => async (game: GameState) =>
            void (await game.swapActivePokemon(
              game.AttackingPlayer,
              "selfEffect"
            )),
        },
      ];

      for (const { pattern, transform } of dictionary) {
        const result = inputMove.Effect.match(pattern);

        if (result) {
          return {
            parseSuccessful,
            value: {
              Name,
              RequiredEnergy,
              Effect: transform(...result),
            },
          };
        }
      }

      return {
        parseSuccessful: false,
        value: {
          Name,
          RequiredEnergy,
          Effect: inputMove.HP
            ? async (game: GameState) => {
                await defaultEffect(game);
                game.GameLog.addEntry({
                  type: "actionFailed",
                  player: game.AttackingPlayer.Name,
                  reason: "partiallyImplemented",
                });
              }
            : async (game: GameState) => {
                game.GameLog.addEntry({
                  type: "actionFailed",
                  player: game.AttackingPlayer.Name,
                  reason: "notImplemented",
                });
              },
        },
      };
    }

    return {
      parseSuccessful,
      value: { Name, RequiredEnergy, Effect: defaultEffect },
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
    const dictionary: EffectTransformer[] = [
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
      {
        pattern: /^Switch out your opponent's Active Pokémon to the Bench\./,
        transform: () => async (game: GameState) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        },
      },
      {
        pattern:
          /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.reduceRetreatCost(Number(modifier));
        },
      },
      {
        pattern:
          /^During this turn, attacks used by your Pokémon do \+(\d+) damage to your opponent's Active Pokémon\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.increaseAttackModifier(Number(modifier));
        },
      },
      {
        pattern:
          /^During your opponent's next turn, all of your Pokémon take −(\d+) damage from attacks from your opponent's Pokémon\.$/,
        transform: (_, modifier) => async (game: GameState) => {
          game.increaseDefenseModifier(Number(modifier));
        },
      },
      {
        pattern: /^Heal (\d+) damage from 1 of your (?:\{(\w)\} )?Pokémon\.$/,
        transform: (_, modifier, type) => async (game: GameState) => {
          let validPokemon = game.AttackingPlayer.InPlayPokemon.filter(
            (x) => x.CurrentHP < x.BaseHP
          );
          if (isEnergyShort(type))
            validPokemon = validPokemon.filter(
              (x) => x.Type == EnergyMap[type]
            );
          const pokemon = await game.choosePokemon(
            game.AttackingPlayer,
            validPokemon
          );
          if (pokemon) game.healPokemon(pokemon, Number(modifier));
        },
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
      value: async (game: GameState) => {
        game.GameLog.addEntry({
          type: "actionFailed",
          player: game.AttackingPlayer.Name,
          reason: "notImplemented",
        });
      },
    };
  };

  return { parseCard, parseMove, parseAbility };
};
