import {
  Game,
  InPlayPokemonCard,
  isEnergyShort,
  parseEnergy,
  type CardSlot,
  type PlayingCard,
  type TrainerEffect,
} from "../gamelogic";

import type { ParsedResult } from "./types";

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => TrainerEffect;
}
export const parseTrainerEffect = (cardText: string): ParsedResult<TrainerEffect> => {
  const dictionary: EffectTransformer[] = [
    {
      pattern: /^Draw (a|\d+) cards?\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: (game: Game) => game.AttackingPlayer.canDraw(),
        effect: async (game: Game) => game.drawCards(count == "a" ? 1 : Number(count)),
      }),
    },
    {
      pattern: /^Put 1 random Basic Pokemon from your deck into your hand\.$/,
      transform: () => ({
        type: "Conditional",
        condition: (game: Game) => game.AttackingPlayer.canDraw(),
        effect: async (game: Game) => {
          game.AttackingPlayer.drawRandomFiltered(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          );
        },
      }),
    },
    {
      pattern: /^Switch out your opponent's Active Pokémon to the Bench\./,
      transform: () => ({
        type: "Conditional",
        condition: (game: Game) => game.DefendingPlayer.BenchedPokemon.length > 0,
        effect: async (game: Game) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        },
      }),
    },
    {
      pattern: /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
      transform: (_, modifier) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game: Game) => {
          game.AttackingPlayer.applyStatus({
            type: "DecreaseRetreatCost",
            category: "Pokemon",
            appliesToPokemon: (pokemon: InPlayPokemonCard, game: Game) =>
              game.AttackingPlayer.ActivePokemon === pokemon,
            source: "Effect",
            amount: Number(modifier),
          });
        },
      }),
    },
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game: Game) => {
          game.DefendingPlayer.shuffleHandIntoDeck();
          game.DefendingPlayer.drawCards(Number(count), game.GameRules.MaxHandSize);
        },
      }),
    },
    {
      pattern: /^Your opponent reveals their hand\.$/,
      transform: () => ({
        type: "Conditional",
        condition: (game: Game) => game.DefendingPlayer.Hand.length > 0,
        effect: async (game: Game) => {
          await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
        },
      }),
    },
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: (game: Game) => game.AttackingPlayer.Deck.length > 0,
        effect: async (game: Game) => {
          await game.showCards(
            game.AttackingPlayer,
            game.AttackingPlayer.Deck.slice(0, Number(count))
          );
        },
      }),
    },
    {
      pattern:
        /^During this turn, attacks used by your Pokémon do \+(\d+) damage to your opponent's Active Pokémon\.$/,
      transform: (_, modifier) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game: Game) => {
          game.AttackingPlayer.applyStatus({
            type: "IncreaseAttack",
            category: "Pokemon",
            appliesToPokemon: () => true,
            source: "Effect",
            amount: Number(modifier),
          });
        },
      }),
    },
    {
      pattern:
        /^During your opponent's next turn, all of your Pokémon take -(\d+) damage from attacks from your opponent's Pokémon\.$/,
      transform: (_, modifier) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game: Game) => {
          game.AttackingPlayer.applyStatus({
            type: "IncreaseDefense",
            category: "Pokemon",
            appliesToPokemon: () => true,
            source: "Effect",
            amount: Number(modifier),
            keepNextTurn: true,
          });
        },
      }),
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your (?:\{(\w)\} )?Pokémon\.$/,
      transform: (_, modifier, type) => ({
        type: "Targeted",
        validTargets: (game: Game) => {
          let validPokemon = game.AttackingPlayer.InPlayPokemon;
          validPokemon = validPokemon.filter((pokemon) => pokemon.CurrentHP < pokemon.BaseHP);
          if (isEnergyShort(type))
            validPokemon = validPokemon.filter((x) => x.Type == parseEnergy(type));
          return validPokemon;
        },
        effect: async (game: Game, pokemon: CardSlot) => {
          if (pokemon.isPokemon) game.healPokemon(pokemon, Number(modifier));
        },
      }),
    },
    {
      pattern:
        /^Choose 1 of your {(\w)} Pokémon, and flip a coin until you get tails\. For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/,
      transform: (_, pokemonType, energyType) => {
        const pt = parseEnergy(pokemonType);
        const et = parseEnergy(energyType);

        return {
          type: "Targeted",
          validTargets: (game: Game) =>
            game.AttackingPlayer.InPlayPokemon.filter((x) => x.Type == pt),
          effect: async (game: Game, pokemon: CardSlot) => {
            if (!pokemon.isPokemon) return;
            const { heads } = game.AttackingPlayer.flipUntilTails();
            game.AttackingPlayer.attachEnergy(pokemon, new Array(heads).fill(et), "energyZone");
          },
        };
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
      transform: (_, pokemon) => {
        const names = parsePokemonNames(pokemon);

        return {
          type: "Conditional",
          condition: (game: Game) => {
            const active = game.AttackingPlayer.ActivePokemon;
            return active.isPokemon && names.includes(active.Name);
          },
          effect: async (game: Game) => {
            await game.AttackingPlayer.returnPokemonToHand(game.AttackingPlayer.activeOrThrow());
          },
        };
      },
    },
    {
      pattern: /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
      transform: (_, energyType, pokemon) => {
        const fullType = parseEnergy(energyType);
        const names = parsePokemonNames(pokemon);

        return {
          type: "Targeted",
          validTargets: (game: Game) =>
            game.AttackingPlayer.InPlayPokemon.filter((x) => names.includes(x.Name)),
          effect: async (game: Game, pokemon: CardSlot) => {
            if (!pokemon.isPokemon) return;
            game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
          },
        };
      },
    },
    {
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
      transform: (_, energyType, pokemonNames) => {
        const fullType = parseEnergy(energyType);
        const names = parsePokemonNames(pokemonNames);

        return {
          type: "Conditional",
          condition: (game: Game) => names.includes(game.AttackingPlayer.activeOrThrow().Name),
          effect: async (game: Game) => {
            for (const pokemon of game.AttackingPlayer.BenchedPokemon) {
              const energyToMove = pokemon.AttachedEnergy.filter((e) => e == fullType);
              if (energyToMove.length > 0) {
                game.AttackingPlayer.transferEnergy(
                  pokemon,
                  game.AttackingPlayer.activeOrThrow(),
                  energyToMove
                );
              }
            }
          },
        };
      },
    },
    {
      pattern:
        /Play this card as if it were a (\d+)-HP Basic {(\w)} Pokémon. At any time during your turn, you may discard this card from play. This card can't retreat./i,
      transform: (_, hp, type) => {
        const fullType = parseEnergy(type);

        return {
          type: "Targeted",
          validTargets: (game: Game) =>
            game.AttackingPlayer.Bench.filter((slot) => !slot.isPokemon),
          effect: async (game: Game, benchSlot: CardSlot) => {
            if (benchSlot.isPokemon) return;
            const card = game.ActiveTrainerCard!;

            const pokemon: PlayingCard = {
              ID: card.ID,
              Name: card.Name,
              CardType: "Pokemon",
              Type: fullType,
              BaseHP: Number(hp),
              Stage: 0,
              RetreatCost: -1,
              Weakness: "",
              PrizePoints: 1,
              Attacks: [],
              Ability: {
                Name: "Discard",
                Trigger: "OnceDuringTurn",
                Conditions: [],
                Text: "Discard this Pokémon from play.",
                Effect: async (game: Game, self: InPlayPokemonCard) => {
                  await game.AttackingPlayer.discardPokemonFromPlay(self);
                },
              },
            };

            await game.AttackingPlayer.putPokemonOnBench(pokemon, benchSlot.index, card);
          },
        };
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
    value: {
      type: "Conditional",
      condition: () => true,
      effect: async (game: Game) => {
        game.GameLog.notImplemented(game.AttackingPlayer);
      },
    },
  };
};

export const parsePokemonNames = (nameString: string) => {
  return nameString.split(/, or | or |, /);
};
