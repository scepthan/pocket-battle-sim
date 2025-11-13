import type { Energy, FossilCard, PokemonCard, TrainerEffect } from "../gamelogic";
import { parseEnergy } from "../gamelogic";
import { randomElement, removeElement } from "../util";
import { parsePlayingCardPredicate, parsePokemonPredicate } from "./parsePredicates";
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
        condition: (game) => game.AttackingPlayer.canDraw(),
        effect: async (game) => game.AttackingPlayer.drawCards(count == "a" ? 1 : Number(count)),
      }),
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\.$/,
      transform: (_, specifier) => {
        const predicate = parsePlayingCardPredicate(specifier);
        return {
          type: "Conditional",
          condition: (game) => game.AttackingPlayer.canDraw(),
          effect: async (game) => {
            game.AttackingPlayer.drawRandomFiltered(predicate);
          },
        };
      },
    },
    {
      pattern: /^Switch out your opponent’s Active Pokémon to the Bench\./,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.DefendingPlayer.BenchedPokemon.length > 0,
        effect: async (game) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        },
      }),
    },
    {
      pattern: /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
      transform: (_, modifier) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          game.AttackingPlayer.applyPlayerStatus({
            type: "DecreaseRetreatCost",
            category: "Pokemon",
            appliesToPokemon: (pokemon, game) => game.AttackingPlayer.ActivePokemon === pokemon,
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
        effect: async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeck();
          game.DefendingPlayer.drawCards(Number(count));
        },
      }),
    },
    {
      pattern: /^Your opponent reveals their hand\.$/,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.DefendingPlayer.Hand.length > 0,
        effect: async (game) => {
          await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
        },
      }),
    },
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: (game) => game.AttackingPlayer.Deck.length > 0,
        effect: async (game) => {
          await game.showCards(
            game.AttackingPlayer,
            game.AttackingPlayer.Deck.slice(0, Number(count))
          );
        },
      }),
    },
    {
      pattern:
        /^During this turn, attacks used by your (.+?) do \+(\d+) damage to your opponent’s Active Pokémon\.$/,
      transform: (_, specifier, modifier) => {
        const appliesToPokemon = parsePokemonPredicate(specifier);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "IncreaseAttack",
              category: "Pokemon",
              appliesToPokemon,
              descriptor: specifier,
              source: "Effect",
              amount: Number(modifier),
            });
          },
        };
      },
    },
    {
      pattern: /^During this turn, attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/,
      transform: (_, specifier, count, energy) => {
        const appliesToPokemon = parsePokemonPredicate(specifier);
        const fullType = parseEnergy(energy);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "ReduceAttackCost",
              category: "Pokemon",
              appliesToPokemon,
              descriptor: specifier,
              source: "Effect",
              energyType: fullType,
              amount: Number(count),
            });
          },
        };
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, all of your (.+?) take −(\d+) damage from attacks from your opponent’s Pokémon\.$/,
      transform: (_, specifier, modifier) => {
        const appliesToPokemon = parsePokemonPredicate(specifier);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "IncreaseDefense",
              category: "Pokemon",
              appliesToPokemon,
              descriptor: specifier,
              source: "Effect",
              amount: Number(modifier),
              keepNextTurn: true,
            });
          },
        };
      },
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your ([^.]+?)\.$/,
      transform: (_, modifier, specifier) => {
        const predicate = parsePokemonPredicate(specifier, (p) => p.isDamaged());
        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, pokemon) => {
            if (pokemon.isPokemon) game.healPokemon(pokemon, Number(modifier));
          },
        };
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your (.+?) that has any {(\w)} Energy attached\.$/,
      transform: (_, modifier, specifier, energyType) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(
          specifier,
          (p) => p.isDamaged() && p.AttachedEnergy.includes(fullType)
        );

        return {
          type: "Conditional",
          condition: (game) => game.AttackingPlayer.InPlayPokemon.some(predicate),
          effect: async (game) => {
            for (const pokemon of game.AttackingPlayer.InPlayPokemon.filter(predicate)) {
              game.healPokemon(pokemon, Number(modifier));
            }
          },
        };
      },
    },
    {
      pattern:
        /^Choose 1 of your {(\w)} Pokémon, and flip a coin until you get tails\. For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/,
      transform: (_, pokemonType, energyType) => {
        const pt = parseEnergy(pokemonType);
        const et = parseEnergy(energyType);

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter((x) => x.Type == pt),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            const { heads } = game.AttackingPlayer.flipUntilTails();
            await game.AttackingPlayer.attachEnergy(
              pokemon,
              new Array(heads).fill(et),
              "energyZone"
            );
          },
        };
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
      transform: (_, specifier) => {
        const predicate = parsePokemonPredicate(specifier);

        return {
          type: "Conditional",
          condition: (game) => predicate(game.AttackingPlayer.activeOrThrow()),
          effect: async (game) => {
            await game.AttackingPlayer.returnPokemonToHand(game.AttackingPlayer.activeOrThrow());
          },
        };
      },
    },
    {
      pattern: /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
      transform: (_, energyType, specifier) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(specifier);

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            await game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
          },
        };
      },
    },
    {
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
      transform: (_, energyType, specifier) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(specifier);

        return {
          type: "Conditional",
          condition: (game) => predicate(game.AttackingPlayer.activeOrThrow()),
          effect: async (game) => {
            for (const pokemon of game.AttackingPlayer.BenchedPokemon) {
              const energyToMove = pokemon.AttachedEnergy.filter((e) => e == fullType);
              if (energyToMove.length > 0) {
                await game.AttackingPlayer.transferEnergy(
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
        /Play this card as if it were a (\d+)-HP Basic \{(\w)\} Pokémon\. At any time during your turn, you may discard this card from play\. This card can’t retreat\./i,
      transform: (_, hp, type) => {
        const fullType = parseEnergy(type);

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.Bench.filter((slot) => !slot.isPokemon),
          effect: async (game, benchSlot) => {
            if (benchSlot.isPokemon) return;
            const card = game.ActiveTrainerCard as FossilCard;

            await game.putFossilOnBench(card, benchSlot.index, Number(hp), fullType);
          },
        };
      },
    },
    {
      pattern: /^Put a Basic Pokémon from your opponent’s discard pile onto their Bench.$/,
      transform: () => ({
        type: "Conditional",
        condition: (game) =>
          game.DefendingPlayer.Bench.some((slot) => !slot.isPokemon) &&
          game.DefendingPlayer.Discard.some(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          ),
        effect: async (game) => {
          const benchIndex = game.DefendingPlayer.Bench.findIndex((slot) => !slot.isPokemon);
          if (benchIndex < 0) return;
          const validCards = game.DefendingPlayer.Discard.filter(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          ) as PokemonCard[];
          const card = await game.choose(game.AttackingPlayer, validCards);
          if (!card) return;
          await game.DefendingPlayer.putPokemonOnBench(card, benchIndex, card);
        },
      }),
    },
    {
      pattern: /^Put 1 random (.+?) from your discard pile into your hand\.$/,
      transform: (_, specifier) => {
        const predicate = parsePlayingCardPredicate(specifier);
        return {
          type: "Conditional",
          condition: (game, self) => self.Discard.some(predicate),
          effect: async (game) => {
            const validCards = game.AttackingPlayer.Discard.filter(predicate);
            const card = randomElement(validCards);
            removeElement(game.AttackingPlayer.Discard, card);
            game.AttackingPlayer.Hand.push(card);
            game.GameLog.putIntoHand(game.AttackingPlayer, [card]);
          },
        };
      },
    },
    {
      pattern:
        /^Look at the top card of your deck. If that card is a {(\w)} Pokémon, put it into your hand. If it is not a {\1} Pokémon, put it on the bottom of your deck.$/i,
      transform: (_, type) => {
        const fullType = parseEnergy(type);

        return {
          type: "Conditional",
          condition: (game) => game.AttackingPlayer.Deck.length > 0,
          effect: async (game) => {
            const topCard = game.AttackingPlayer.Deck.shift()!;
            await game.showCards(game.AttackingPlayer, [topCard]);

            if (topCard.CardType == "Pokemon" && topCard.Type == fullType) {
              game.AttackingPlayer.Hand.push(topCard);
              game.GameLog.putIntoHand(game.AttackingPlayer, [topCard]);
            } else {
              game.AttackingPlayer.Deck.push(topCard);
              game.GameLog.returnToBottomOfDeck(game.AttackingPlayer, [topCard]);
            }
          },
        };
      },
    },
    {
      pattern:
        /^Switch in 1 of your opponent’s Benched Pokémon that has damage on it to the Active Spot\.$/i,
      transform: () => ({
        type: "Targeted",
        validTargets: (game) => game.DefendingPlayer.BenchedPokemon.filter((p) => p.isDamaged()),
        effect: async (game, target) => {
          if (!target.isPokemon) return;
          await game.DefendingPlayer.swapActivePokemon(
            target,
            "opponentEffect",
            game.AttackingPlayer.Name
          );
        },
      }),
    },
    {
      pattern:
        /^Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win\.$/i,
      transform: () => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeck();
          const cardsToDraw = game.GameRules.PrizePoints - game.DefendingPlayer.GamePoints;
          game.DefendingPlayer.drawCards(cardsToDraw);
        },
      }),
    },
    {
      pattern: /^Choose a Pokémon in your hand and switch it with a random Pokémon in your deck.$/i,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.AttackingPlayer.Hand.some((c) => c.CardType == "Pokemon"),
        effect: async (game) => {
          const handPokemon = game.AttackingPlayer.Hand.filter((c) => c.CardType == "Pokemon");
          const chosen = await game.choose(game.AttackingPlayer, handPokemon);
          if (!chosen) return;

          const deckPokemon = game.AttackingPlayer.Deck.filter((c) => c.CardType == "Pokemon");
          if (deckPokemon.length == 0) {
            game.GameLog.noValidCards(game.AttackingPlayer);
            return;
          }
          const pokemonFromDeck = randomElement(deckPokemon);

          removeElement(game.AttackingPlayer.Hand, chosen);
          game.AttackingPlayer.Deck.push(chosen);
          game.GameLog.returnToDeck(game.AttackingPlayer, [chosen], "hand");

          removeElement(game.AttackingPlayer.Deck, pokemonFromDeck);
          game.AttackingPlayer.Hand.push(pokemonFromDeck);
          game.GameLog.putIntoHand(game.AttackingPlayer, [pokemonFromDeck]);

          game.AttackingPlayer.shuffleDeck();
        },
      }),
    },
    {
      pattern:
        /^Choose 1 of your (.+?)\. Attach (\d+) \{(\w)\} Energy from your discard pile to that Pokémon\.$/,
      transform: (_, specifier, count, energyType) => {
        const predicate = parsePokemonPredicate(specifier);
        const fullType = parseEnergy(energyType);

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          condition: (game) => game.AttackingPlayer.DiscardedEnergy.some((e) => e == fullType),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            const energyToAttach: Energy[] = [];
            for (let i = 0; i < Number(count); i++) {
              if (!game.AttackingPlayer.DiscardedEnergy.includes(fullType)) break;
              energyToAttach.push(fullType);
              removeElement(game.AttackingPlayer.DiscardedEnergy, fullType);
            }
            await game.AttackingPlayer.attachEnergy(pokemon, energyToAttach, "discard");
          },
        };
      },
    },
    {
      pattern: /^Move an Energy from 1 of your Benched Pokémon to your Active Pokémon\.$/,
      transform: () => ({
        type: "Targeted",
        validTargets: (game) =>
          game.AttackingPlayer.BenchedPokemon.filter((p) => p.AttachedEnergy.length > 0),
        effect: async (game, target) => {
          const player = game.AttackingPlayer;
          if (!target.isPokemon) return;
          const energy = await game.choose(player, target.AttachedEnergy);
          if (!energy) return;
          await player.transferEnergy(target, player.activeOrThrow(), [energy]);
        },
      }),
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
      effect: async (game) => {
        game.GameLog.notImplemented(game.AttackingPlayer);
      },
    },
  };
};
