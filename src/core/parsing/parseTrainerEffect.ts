import type { Game } from "../gamelogic";
import { type Effect, isEnergyShort, parseEnergy, type PlayingCard } from "../types";
import type { ParsedResult } from "./types";

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => Effect;
}
export const parseTrainerEffect = (cardText: string): ParsedResult<Effect> => {
  const dictionary: EffectTransformer[] = [
    {
      pattern: /^Draw (a|\d+) cards?\.$/,
      transform: (_, count) => async (game: Game) =>
        game.drawCards(count == "a" ? 1 : Number(count)),
    },
    {
      pattern: /^Put 1 random Basic Pokemon from your deck into your hand\.$/,
      transform: () => async (game: Game) =>
        game.AttackingPlayer.drawRandomFiltered(
          (card) => card.CardType == "Pokemon" && card.Stage == 0
        ),
    },
    {
      pattern: /^Switch out your opponent's Active Pokémon to the Bench\./,
      transform: () => async (game: Game) => {
        await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
      },
    },
    {
      pattern: /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
      transform: (_, modifier) => async (game: Game) => {
        game.reduceRetreatCost(Number(modifier));
      },
    },
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/,
      transform: (_, count) => async (game: Game) => {
        game.DefendingPlayer.shuffleHandIntoDeck();
        game.DefendingPlayer.drawCards(Number(count), game.GameRules.MaxHandSize);
      },
    },
    {
      pattern: /^Your opponent reveals their hand\.$/,
      transform: () => async (game: Game) => {
        await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
      },
    },
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/,
      transform: (_, count) => async (game: Game) => {
        await game.showCards(
          game.AttackingPlayer,
          game.AttackingPlayer.Deck.slice(0, Number(count))
        );
      },
    },
    {
      pattern:
        /^During this turn, attacks used by your Pokémon do \+(\d+) damage to your opponent's Active Pokémon\.$/,
      transform: (_, modifier) => async (game: Game) => {
        game.increaseAttackModifier(Number(modifier));
      },
    },
    {
      pattern:
        /^During your opponent's next turn, all of your Pokémon take -(\d+) damage from attacks from your opponent's Pokémon\.$/,
      transform: (_, modifier) => async (game: Game) => {
        game.increaseDefenseModifier(Number(modifier));
      },
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your (?:\{(\w)\} )?Pokémon\.$/,
      transform: (_, modifier, type) => async (game: Game) => {
        let validPokemon = game.AttackingPlayer.InPlayPokemon.filter((x) => x.CurrentHP < x.BaseHP);
        if (isEnergyShort(type))
          validPokemon = validPokemon.filter((x) => x.Type == parseEnergy(type));
        const pokemon = await game.choosePokemon(game.AttackingPlayer, validPokemon);
        if (pokemon) game.healPokemon(pokemon, Number(modifier));
      },
    },
    {
      pattern:
        /^Choose 1 of your {(\w)} Pokémon, and flip a coin until you get tails\. For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/,
      transform: (_, pokemonType, energyType) => {
        const pt = parseEnergy(pokemonType);
        const et = parseEnergy(energyType);

        return async (game: Game) => {
          const validPokemon = game.AttackingPlayer.InPlayPokemon.filter((x) => x.Type == pt);
          const pokemon = await game.choosePokemon(game.AttackingPlayer, validPokemon);
          if (pokemon) {
            const { heads } = game.AttackingPlayer.flipUntilTails();
            game.AttackingPlayer.attachEnergy(pokemon, new Array(heads).fill(et), "energyZone");
          }
        };
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
      transform: (_, pokemon) => {
        const names = parsePokemonNames(pokemon);

        return async (game: Game) => {
          const active = game.AttackingPlayer.ActivePokemon;
          if (active.isPokemon && names.includes(active.Name)) {
            game.AttackingPlayer.returnPokemonToHand(active);
          } else {
            game.GameLog.noValidTargets(game.AttackingPlayer);
          }
        };
      },
    },
    {
      pattern: /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
      transform: (_, energyType, pokemon) => {
        const fullType = parseEnergy(energyType);
        const names = parsePokemonNames(pokemon);

        return async (game: Game) => {
          const validPokemon = game.AttackingPlayer.InPlayPokemon.filter((x) =>
            names.includes(x.Name)
          );
          if (validPokemon.length > 0) {
            const pokemon = await game.choosePokemon(game.AttackingPlayer, validPokemon);
            if (pokemon) {
              game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
            }
          } else {
            game.GameLog.noValidTargets(game.AttackingPlayer);
          }
        };
      },
    },
    {
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
      transform: (_, energyType, pokemonNames) => {
        const fullType = parseEnergy(energyType);
        const names = parsePokemonNames(pokemonNames);

        return async (game: Game) => {
          if (!names.includes(game.AttackingPlayer.activeOrThrow().Name)) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }
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
        };
      },
    },
    {
      pattern:
        /Play this card as if it were a (\d+)-HP Basic {(\w)} Pokémon. At any time during your turn, you may discard this card from play. This card can't retreat./i,
      transform: (_, hp, type) => {
        const fullType = parseEnergy(type);

        return async (game: Game) => {
          const card = game.ActiveTrainerCard!;
          let benchIndex = 0;
          while (game.AttackingPlayer.Bench[benchIndex]) benchIndex++;
          if (benchIndex >= 3) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }

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
          };

          await game.AttackingPlayer.putPokemonOnBench(pokemon, benchIndex, card);
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
    value: async (game: Game) => {
      game.GameLog.notImplemented(game.AttackingPlayer);
    },
  };
};

const parsePokemonNames = (nameString: string) => {
  return nameString.split(/, or | or |, /);
};
