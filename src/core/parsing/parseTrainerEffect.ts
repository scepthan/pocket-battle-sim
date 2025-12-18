import { allCards } from "@/assets";
import type { Energy, FossilCard, PokemonCard, TrainerEffect } from "../gamelogic";
import { parseEnergy } from "../gamelogic";
import { randomElement, removeElement } from "../util";
import {
  parsePlayingCardPredicate as _cardParse,
  parsePokemonPredicate as _pokemonParse,
  type InPlayPokemonPredicate,
} from "./parsePredicates";
import type { ParsedResult } from "./types";

const findBasicForStage2 = (stage2: PokemonCard) => {
  const stage1Name = stage2.EvolvesFrom;
  if (!stage1Name) return null;
  const stage1 = allCards.find((card) => card.name === stage1Name);
  if (!stage1 || stage1.cardType !== "Pokemon") return null;
  return stage1.previousEvolution ?? null;
};

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => TrainerEffect;
}
export const parseTrainerEffect = (cardText: string): ParsedResult<TrainerEffect> => {
  let parseSuccessful = true;

  const parsePokemonPredicate = (descriptor: string, initial?: InPlayPokemonPredicate) => {
    const { parseSuccessful: success, value } = _pokemonParse(descriptor, initial);
    if (!success) parseSuccessful = false;
    return value;
  };
  const parsePlayingCardPredicate = (descriptor: string) => {
    const { parseSuccessful: success, value } = _cardParse(descriptor);
    if (!success) parseSuccessful = false;
    return value;
  };

  const dictionary: EffectTransformer[] = [
    // Draw effects
    {
      pattern: /^Draw (a|\d+) cards?\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: (game) => game.AttackingPlayer.canDraw(true),
        effect: async (game) => game.AttackingPlayer.drawCards(count == "a" ? 1 : Number(count)),
      }),
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        return {
          type: "Conditional",
          condition: (game) => game.AttackingPlayer.canDraw(true),
          effect: async (game) => {
            game.AttackingPlayer.drawRandomFilteredToHand(predicate);
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
      pattern: /^Choose a Pokémon in your hand and switch it with a random Pokémon in your deck.$/i,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.AttackingPlayer.Hand.some((c) => c.CardType == "Pokemon"),
        effect: async (game) => {
          const handPokemon = game.AttackingPlayer.Hand.filter((c) => c.CardType == "Pokemon");
          const chosen = await game.chooseCard(game.AttackingPlayer, handPokemon);
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
      pattern: /^Put (?:a|1) random (.+?) from your discard pile into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
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
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/,
      transform: (_, count) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(Number(count));
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
          const cardsToDraw = game.GameRules.PrizePoints - game.DefendingPlayer.GamePoints;
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(cardsToDraw);
        },
      }),
    },
    {
      pattern:
        /^Each player shuffles the cards in their hand into their deck, then draws that many cards\.$/i,
      transform: () => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(game.DefendingPlayer.Hand.length);
          game.AttackingPlayer.shuffleHandIntoDeckAndDraw(game.AttackingPlayer.Hand.length);
        },
      }),
    },

    // Informational effects
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
      pattern: /^Look at the top card of your deck\. Then, you may shuffle your deck\.$/,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.AttackingPlayer.Deck.length > 0,
        effect: async (game) => {
          await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
          const choice = await game.chooseYesNo(game.AttackingPlayer, "Shuffle deck?");
          if (choice) game.AttackingPlayer.shuffleDeck();
        },
      }),
    },

    // Status effects
    {
      pattern: /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
      transform: (_, modifier) => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          game.AttackingPlayer.applyPlayerStatus({
            type: "PokemonStatus",
            pokemonCondition: {
              test: (pokemon) => pokemon.player.ActivePokemon === pokemon,
              descriptor: "Active Pokémon",
            },
            source: "Effect",
            pokemonStatus: {
              type: "ReduceRetreatCost",
              amount: Number(modifier),
              source: "Effect",
            },
          });
        },
      }),
    },
    {
      pattern:
        /^During this turn, attacks used by your (.+?) do \+(\d+) damage to your opponent’s (Active .+?)\.$/,
      transform: (_, selfSpecifier, modifier, opponentSpecifier) => {
        const appliesToPokemon = parsePokemonPredicate(selfSpecifier);
        const appliesToDefender = parsePokemonPredicate(opponentSpecifier);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "PokemonStatus",
              pokemonCondition: {
                test: appliesToPokemon,
                descriptor: selfSpecifier,
              },
              source: "Effect",
              pokemonStatus: {
                type: "IncreaseAttack",
                amount: Number(modifier),
                defenderCondition: {
                  test: appliesToDefender,
                  descriptor: opponentSpecifier,
                },
                source: "Effect",
              },
            });
          },
        };
      },
    },
    {
      pattern: /^During this turn, attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/,
      transform: (_, descriptor, count, energy) => {
        const predicate = parsePokemonPredicate(descriptor);
        const fullType = parseEnergy(energy);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "PokemonStatus",
              pokemonCondition: {
                test: predicate,
                descriptor,
              },
              source: "Effect",
              pokemonStatus: {
                type: "ReduceAttackCost",
                energyType: fullType,
                amount: Number(count),
                source: "Effect",
              },
            });
          },
        };
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, all of your (.+?) take −(\d+) damage from attacks from your opponent’s Pokémon\.$/,
      transform: (_, descriptor, modifier) => {
        const predicate = parsePokemonPredicate(descriptor);

        return {
          type: "Conditional",
          condition: () => true,
          effect: async (game) => {
            game.AttackingPlayer.applyPlayerStatus({
              type: "PokemonStatus",
              pokemonCondition: {
                test: predicate,
                descriptor,
              },
              source: "Effect",
              keepNextTurn: true,
              pokemonStatus: {
                type: "ReduceAttackDamage",
                amount: Number(modifier),
                source: "Effect",
              },
            });
          },
        };
      },
    },

    // Healing effects
    {
      pattern:
        /^Heal (\d+) damage from 1 of your ([^.]+?), and it recovers from all Special Conditions\.$/,
      transform: (_, modifier, descriptor) => {
        const predicate = parsePokemonPredicate(
          descriptor,
          (p) => p.isDamaged() || p.hasSpecialCondition()
        );
        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            pokemon.healDamage(Number(modifier));
            pokemon.removeAllSpecialConditions();
          },
        };
      },
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your ([^.]+?)\.$/,
      transform: (_, modifier, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, pokemon) => {
            if (pokemon.isPokemon) pokemon.healDamage(Number(modifier));
          },
        };
      },
    },
    {
      pattern:
        /^Heal all damage from 1 of your ([^.]+?)\. If you do, discard all Energy from that Pokémon\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            pokemon.healDamage(pokemon.MaxHP - pokemon.CurrentHP);
            await game.discardAllEnergy(pokemon);
          },
        };
      },
    },
    {
      pattern:
        /^Heal (\d+) damage and remove a random Special Condition from your Active Pokémon\.$/,
      transform: (_, modifier) => {
        return {
          type: "Conditional",
          condition: (game) => {
            const active = game.AttackingPlayer.activeOrThrow();
            return active.isDamaged() || active.hasSpecialCondition();
          },
          effect: async (game) => {
            const active = game.AttackingPlayer.activeOrThrow();
            active.healDamage(Number(modifier));
            active.removeRandomSpecialCondition();
          },
        };
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your (.+?) that has any {(\w)} Energy attached\.$/,
      transform: (_, modifier, descriptor, energyType) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(
          descriptor,
          (p) => p.isDamaged() && p.AttachedEnergy.includes(fullType)
        );

        return {
          type: "Conditional",
          condition: (game) => game.AttackingPlayer.InPlayPokemon.some(predicate),
          effect: async (game) => {
            for (const pokemon of game.AttackingPlayer.InPlayPokemon.filter(predicate)) {
              pokemon.healDamage(Number(modifier));
            }
          },
        };
      },
    },
    {
      pattern:
        /^Choose 1 of your (.+?) that has damage on it, and move (\d+) of its damage to your opponent’s Active Pokémon\.$/,
      transform: (_, descriptor, amount) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          effect: async (game, target) => {
            if (!target.isPokemon) return;
            target.healDamage(Number(amount));
            game.applyDamage(game.DefendingPlayer.activeOrThrow(), Number(amount), false);
          },
        };
      },
    },

    // Energy effects
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
      pattern: /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

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
        /^Choose 1 of your (.+?)\. Take (\d+) \{(\w)\} Energy from your Energy Zone and attach it to that Pokémon\.( Your turn ends\.)$/,
      transform: (_, descriptor, count, energyType, endTurn) => {
        const predicate = parsePokemonPredicate(descriptor);
        const fullType = parseEnergy(energyType);
        const energyToAttach = new Array(Number(count)).fill(fullType);

        return {
          type: "Targeted",
          validTargets: (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          condition: (game) => game.AttackingPlayer.DiscardedEnergy.some((e) => e == fullType),
          effect: async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            await game.AttackingPlayer.attachEnergy(pokemon, energyToAttach, "energyZone");
            if (endTurn) game.endTurnResolve(true);
          },
        };
      },
    },
    {
      pattern:
        /^Choose 1 of your (.+?)\. Attach (\d+) \{(\w)\} Energy from your discard pile to that Pokémon\.$/,
      transform: (_, descriptor, count, energyType) => {
        const predicate = parsePokemonPredicate(descriptor);
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
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

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
      pattern: /^Move an Energy from 1 of your Benched Pokémon to your Active Pokémon\.$/,
      transform: () => ({
        type: "Targeted",
        validTargets: (game) =>
          game.AttackingPlayer.BenchedPokemon.filter((p) => p.AttachedEnergy.length > 0),
        effect: async (game, target) => {
          const player = game.AttackingPlayer;
          if (!target.isPokemon) return;
          const prompt = "Choose an Energy to move.";
          const energy = await game.chooseNEnergy(player, target.AttachedEnergy, 1, prompt);
          await player.transferEnergy(target, player.activeOrThrow(), energy);
        },
      }),
    },
    {
      pattern:
        /^Flip a coin until you get tails\. For each heads, discard a random Energy from your opponent’s Active Pokémon\.$/,
      transform: () => ({
        type: "Conditional",
        condition: () => true,
        effect: async (game) => {
          const { heads } = game.AttackingPlayer.flipUntilTails();
          const active = game.DefendingPlayer.activeOrThrow();
          await game.DefendingPlayer.discardRandomEnergyFromPokemon(active, heads);
        },
      }),
    },

    // Switching effects
    {
      pattern: /^Switch out your opponent’s Active Pokémon to the Bench\./,
      transform: () => ({
        type: "Conditional",
        condition: (game) => game.DefendingPlayer.BenchedPokemon.length > 0,
        effect: async (game) => {
          await game.chooseNewActivePokemon(game.DefendingPlayer);
        },
      }),
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
        /^You can use this card only if you have (.+?) in play\. Switch in 1 of your opponent’s Benched Pokémon to the Active Spot\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        return {
          type: "Targeted",
          condition: (game) => game.AttackingPlayer.InPlayPokemon.some(predicate),
          validTargets: (game) => game.DefendingPlayer.BenchedPokemon,
          effect: async (game, target) => {
            if (!target.isPokemon) return;
            await game.DefendingPlayer.swapActivePokemon(
              target,
              "opponentEffect",
              game.AttackingPlayer.Name
            );
          },
        };
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        return {
          type: "Conditional",
          condition: (game) => predicate(game.AttackingPlayer.activeOrThrow()),
          effect: async (game) => {
            await game.AttackingPlayer.returnPokemonToHand(game.AttackingPlayer.activeOrThrow());
          },
        };
      },
    },

    // Pokemon-playing effects
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
          );
          const card = await game.chooseCard(game.AttackingPlayer, validCards);
          if (!card) return;
          await game.DefendingPlayer.putPokemonOnBench(card as PokemonCard, benchIndex, card);
        },
      }),
    },
    {
      pattern:
        /^Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1. You can’t use this card during your first turn or on a Basic Pokémon that was put into play this turn.$/,
      transform: () => ({
        type: "Targeted",
        validTargets: (game) => {
          const validBasicNames = game.AttackingPlayer.Hand.filter(
            (card) => card.CardType === "Pokemon" && card.Stage == 2
          )
            .map((card) => findBasicForStage2(card as PokemonCard))
            .filter((name) => name !== null);

          return game.AttackingPlayer.InPlayPokemon.filter(
            (p) => p.Stage == 0 && p.ReadyToEvolve && validBasicNames.includes(p.Name)
          );
        },
        effect: async (game, target) => {
          if (!target.isPokemon) return;

          const validCards = game.AttackingPlayer.Hand.filter(
            (card) =>
              card.CardType === "Pokemon" &&
              card.Stage == 2 &&
              findBasicForStage2(card as PokemonCard) === target.Name
          );
          const card = await game.chooseCard(game.AttackingPlayer, validCards);
          if (!card) return;

          await game.AttackingPlayer.evolvePokemon(target, card as PokemonCard, true);
        },
      }),
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
  ];

  for (const { pattern, transform } of dictionary) {
    const result = cardText.match(pattern);

    if (result) {
      const value = transform(...result);
      return { parseSuccessful, value };
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
