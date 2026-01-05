import { allCards } from "@/assets";
import type {
  CardSlot,
  Energy,
  FossilCard,
  Game,
  PokemonCard,
  TargetedEffect,
  TrainerEffect,
} from "../gamelogic";
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
  transform: (...args: string[]) => void;
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

  let effect: TrainerEffect = {
    type: "Conditional",
    condition: () => true,
    effect: async (game) => {
      game.GameLog.notImplemented(game.AttackingPlayer);
    },
  };
  const convertToTargetedEffect = (
    validTargets: (game: Game) => CardSlot[],
    newEffect: TargetedEffect<CardSlot>
  ) => {
    effect = {
      type: "Targeted",
      condition: effect.condition,
      validTargets,
      effect: newEffect,
    };
  };

  const dictionary: EffectTransformer[] = [
    // Draw effects
    {
      pattern: /^Draw (a|\d+) cards?\.$/,
      transform: (_, count) => {
        effect.condition = (game) => game.AttackingPlayer.canDraw(true);
        effect.effect = async (game: Game) =>
          game.AttackingPlayer.drawCards(count == "a" ? 1 : Number(count));
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.condition = (game) => game.AttackingPlayer.canDraw(true);
        effect.effect = async (game: Game) => {
          game.AttackingPlayer.drawRandomFilteredToHand(predicate);
        };
      },
    },
    {
      pattern:
        /^Look at the top card of your deck. If that card is a (.+?), put it into your hand. If it is not a \1, put it on the bottom of your deck.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);

        effect.condition = (game) => game.AttackingPlayer.Deck.length > 0;
        effect.effect = async (game: Game) => {
          const topCard = game.AttackingPlayer.Deck.shift()!;
          await game.showCards(game.AttackingPlayer, [topCard]);

          if (predicate(topCard)) {
            game.AttackingPlayer.Hand.push(topCard);
            game.GameLog.putIntoHand(game.AttackingPlayer, [topCard]);
          } else {
            game.AttackingPlayer.Deck.push(topCard);
            game.GameLog.returnToBottomOfDeck(game.AttackingPlayer, [topCard]);
          }
        };
      },
    },
    {
      pattern: /^Choose a (.+?) in your hand and switch it with a random \1 in your deck.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.condition = (game) => game.AttackingPlayer.Hand.some(predicate);
        effect.effect = async (game: Game) => {
          const validHandCards = game.AttackingPlayer.Hand.filter(predicate);
          const chosen = await game.chooseCard(game.AttackingPlayer, validHandCards);
          if (!chosen) return;

          const validDeckCards = game.AttackingPlayer.Deck.filter(predicate);
          if (validDeckCards.length == 0) {
            game.GameLog.noValidCards(game.AttackingPlayer);
            return;
          }
          const pokemonFromDeck = randomElement(validDeckCards);

          removeElement(game.AttackingPlayer.Hand, chosen);
          game.AttackingPlayer.Deck.push(chosen);
          game.GameLog.returnToDeck(game.AttackingPlayer, [chosen], "hand");

          removeElement(game.AttackingPlayer.Deck, pokemonFromDeck);
          game.AttackingPlayer.Hand.push(pokemonFromDeck);
          game.GameLog.putIntoHand(game.AttackingPlayer, [pokemonFromDeck]);

          game.AttackingPlayer.shuffleDeck();
        };
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your discard pile into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.condition = (game, self) => self.Discard.some(predicate);
        effect.effect = async (game: Game) => {
          const validCards = game.AttackingPlayer.Discard.filter(predicate);
          const card = randomElement(validCards);
          removeElement(game.AttackingPlayer.Discard, card);
          game.AttackingPlayer.Hand.push(card);
          game.GameLog.putIntoHand(game.AttackingPlayer, [card]);
        };
      },
    },
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/,
      transform: (_, count) => {
        effect.effect = async (game: Game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(Number(count));
        };
      },
    },
    {
      pattern:
        /^Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win\.$/i,
      transform: () => {
        effect.effect = async (game: Game) => {
          const cardsToDraw = game.GameRules.PrizePoints - game.DefendingPlayer.GamePoints;
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(cardsToDraw);
        };
      },
    },
    {
      pattern:
        /^Each player shuffles the cards in their hand into their deck, then draws that many cards\.$/i,
      transform: () => {
        effect.effect = async (game: Game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(game.DefendingPlayer.Hand.length);
          game.AttackingPlayer.shuffleHandIntoDeckAndDraw(game.AttackingPlayer.Hand.length);
        };
      },
    },

    // Informational effects
    {
      pattern: /^Your opponent reveals their hand\.$/,
      transform: () => {
        effect.condition = (game) => game.DefendingPlayer.Hand.length > 0;
        effect.effect = async (game: Game) => {
          await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
        };
      },
    },
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/,
      transform: (_, count) => {
        effect.condition = (game) => game.AttackingPlayer.Deck.length > 0;
        effect.effect = async (game: Game) => {
          await game.showCards(
            game.AttackingPlayer,
            game.AttackingPlayer.Deck.slice(0, Number(count))
          );
        };
      },
    },
    {
      pattern: /^Look at the top card of your deck\. Then, you may shuffle your deck\.$/,
      transform: () => {
        effect.condition = (game) => game.AttackingPlayer.Deck.length > 0;
        effect.effect = async (game: Game) => {
          await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
          const choice = await game.chooseYesNo(game.AttackingPlayer, "Shuffle deck?");
          if (choice) game.AttackingPlayer.shuffleDeck();
        };
      },
    },

    // Status effects
    {
      pattern: /^During this turn, the Retreat Cost of your Active Pokémon is (\d+) less\.$/,
      transform: (_, modifier) => {
        effect.effect = async (game: Game) => {
          game.AttackingPlayer.applyPlayerStatus({
            type: "PokemonStatus",
            pokemonCondition: {
              test: (pokemon) => pokemon.player.ActivePokemon === pokemon,
              descriptor: "Active Pokémon",
            },
            source: "Effect",
            pokemonStatus: {
              type: "ModifyRetreatCost",
              amount: -Number(modifier),
              source: "Effect",
            },
          });
        };
      },
    },
    {
      pattern:
        /^During this turn, attacks used by your (.+?) do \+(\d+) damage to your opponent’s (Active .+?)\.$/,
      transform: (_, selfSpecifier, modifier, opponentSpecifier) => {
        const appliesToPokemon = parsePokemonPredicate(selfSpecifier);
        const appliesToDefender = parsePokemonPredicate(opponentSpecifier);

        effect.effect = async (game: Game) => {
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
        };
      },
    },
    {
      pattern: /^During this turn, attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/,
      transform: (_, descriptor, count, energy) => {
        const predicate = parsePokemonPredicate(descriptor);
        const fullType = parseEnergy(energy);

        effect.effect = async (game: Game) => {
          game.AttackingPlayer.applyPlayerStatus({
            type: "PokemonStatus",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            source: "Effect",
            pokemonStatus: {
              type: "ModifyAttackCost",
              energyType: fullType,
              amount: -Number(count),
              source: "Effect",
            },
          });
        };
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, all of your (.+?) take −(\d+) damage from attacks from your opponent’s Pokémon\.$/,
      transform: (_, descriptor, modifier) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.effect = async (game: Game) => {
          game.AttackingPlayer.applyPlayerStatus({
            type: "PokemonStatus",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            source: "Effect",
            keepNextTurn: true,
            pokemonStatus: {
              type: "ModifyIncomingAttackDamage",
              amount: -Number(modifier),
              source: "Effect",
            },
          });
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
        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            pokemon.healDamage(Number(modifier));
            pokemon.removeAllSpecialConditions();
          }
        );
      },
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your ([^.]+?)\.$/,
      transform: (_, modifier, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (pokemon.isPokemon) pokemon.healDamage(Number(modifier));
          }
        );
      },
    },
    {
      pattern:
        /^Heal all damage from 1 of your ([^.]+?)\. If you do, discard all Energy from that Pokémon\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            pokemon.healDamage(pokemon.MaxHP - pokemon.CurrentHP);
            await game.discardAllEnergy(pokemon);
          }
        );
      },
    },
    {
      pattern:
        /^Heal (\d+) damage and remove a random Special Condition from your Active Pokémon\.$/,
      transform: (_, modifier) => {
        effect.condition = (game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          return active.isDamaged() || active.hasSpecialCondition();
        };
        effect.effect = async (game: Game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          active.healDamage(Number(modifier));
          active.removeRandomSpecialCondition();
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

        effect.condition = (game) => game.AttackingPlayer.InPlayPokemon.some(predicate);
        effect.effect = async (game: Game) => {
          for (const pokemon of game.AttackingPlayer.InPlayPokemon.filter(predicate)) {
            pokemon.healDamage(Number(modifier));
          }
        };
      },
    },
    {
      pattern:
        /^Choose 1 of your (.+?) that has damage on it, and move (\d+) of its damage to your opponent’s Active Pokémon\.$/,
      transform: (_, descriptor, amount) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, target) => {
            if (!target.isPokemon) return;
            target.healDamage(Number(amount));
            game.applyDamage(game.DefendingPlayer.activeOrThrow(), Number(amount), false);
          }
        );
      },
    },

    // Energy effects
    {
      pattern:
        /^Choose 1 of your {(\w)} Pokémon, and flip a coin until you get tails\. For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/,
      transform: (_, pokemonType, energyType) => {
        const pt = parseEnergy(pokemonType);
        const et = parseEnergy(energyType);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter((x) => x.Type == pt),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            const { heads } = game.AttackingPlayer.flipUntilTails();
            await game.AttackingPlayer.attachEnergy(
              pokemon,
              new Array(heads).fill(et),
              "energyZone"
            );
          }
        );
      },
    },
    {
      pattern: /^Take a {(\w)} Energy from your Energy Zone and attach it to (.+?)\.$/,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            await game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
          }
        );
      },
    },
    {
      pattern:
        /^Choose 1 of your (.+?)\. Take (\d+) \{(\w)\} Energy from your Energy Zone and attach it to that Pokémon\.( Your turn ends\.)$/,
      transform: (_, descriptor, count, energyType, endTurn) => {
        const predicate = parsePokemonPredicate(descriptor);
        const fullType = parseEnergy(energyType);
        const energyToAttach = new Array(Number(count)).fill(fullType);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            await game.AttackingPlayer.attachEnergy(pokemon, energyToAttach, "energyZone");
            if (endTurn) game.endTurnResolve(true);
          }
        );
        effect.condition = (game) =>
          game.AttackingPlayer.DiscardedEnergy.some((e) => e == fullType);
      },
    },
    {
      pattern:
        /^Choose 1 of your (.+?)\. Attach (\d+) \{(\w)\} Energy from your discard pile to that Pokémon\.$/,
      transform: (_, descriptor, count, energyType) => {
        const predicate = parsePokemonPredicate(descriptor);
        const fullType = parseEnergy(energyType);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, pokemon) => {
            if (!pokemon.isPokemon) return;
            const energyToAttach: Energy[] = [];
            for (let i = 0; i < Number(count); i++) {
              if (!game.AttackingPlayer.DiscardedEnergy.includes(fullType)) break;
              energyToAttach.push(fullType);
              removeElement(game.AttackingPlayer.DiscardedEnergy, fullType);
            }
            await game.AttackingPlayer.attachEnergy(pokemon, energyToAttach, "discard");
          }
        );
        effect.condition = (game) =>
          game.AttackingPlayer.DiscardedEnergy.some((e) => e == fullType);
      },
    },
    {
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

        effect.condition = (game) => predicate(game.AttackingPlayer.activeOrThrow());
        effect.effect = async (game: Game) => {
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
        };
      },
    },
    {
      pattern: /^Move an Energy from 1 of your Benched Pokémon to your Active Pokémon\.$/,
      transform: () => {
        convertToTargetedEffect(
          (game) => game.AttackingPlayer.BenchedPokemon.filter((p) => p.AttachedEnergy.length > 0),
          async (game, target) => {
            const player = game.AttackingPlayer;
            if (!target.isPokemon) return;
            const prompt = "Choose an Energy to move.";
            const energy = await game.chooseNEnergy(player, target.AttachedEnergy, 1, prompt);
            await player.transferEnergy(target, player.activeOrThrow(), energy);
          }
        );
      },
    },
    {
      pattern:
        /^Flip a coin until you get tails\. For each heads, discard a random Energy from your opponent’s Active Pokémon\.$/,
      transform: () => {
        effect.effect = async (game: Game) => {
          const { heads } = game.AttackingPlayer.flipUntilTails();
          const active = game.DefendingPlayer.activeOrThrow();
          await game.DefendingPlayer.discardRandomEnergyFromPokemon(active, heads);
        };
      },
    },

    // Switching effects
    {
      pattern:
        /^Switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)/i,
      transform: () => {
        effect.condition = (game) => game.DefendingPlayer.BenchedPokemon.length > 0;
        effect.effect = async (game: Game) => {
          await game.chooseNewActivePokemon(game.DefendingPlayer);
        };
      },
    },
    {
      pattern:
        /^Switch in 1 of your opponent’s Benched Pokémon that has damage on it to the Active Spot\.$/i,
      transform: () => {
        convertToTargetedEffect(
          (game) => game.DefendingPlayer.BenchedPokemon.filter((p) => p.isDamaged()),
          async (game, target) => {
            if (!target.isPokemon) return;
            await game.DefendingPlayer.swapActivePokemon(
              target,
              "opponentEffect",
              game.AttackingPlayer.Name
            );
          }
        );
      },
    },
    {
      pattern:
        /^You can use this card only if you have (.+?) in play\. Switch in 1 of your opponent’s Benched Pokémon to the Active Spot\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToTargetedEffect(
          (game) => game.DefendingPlayer.BenchedPokemon,
          async (game, target) => {
            if (!target.isPokemon) return;
            await game.DefendingPlayer.swapActivePokemon(
              target,
              "opponentEffect",
              game.AttackingPlayer.Name
            );
          }
        );

        effect.condition = (game) => game.AttackingPlayer.InPlayPokemon.some(predicate);
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.condition = (game) => predicate(game.AttackingPlayer.activeOrThrow());
        effect.effect = async (game: Game) => {
          await game.AttackingPlayer.returnPokemonToHand(game.AttackingPlayer.activeOrThrow());
        };
      },
    },
    {
      pattern: /^Put 1 of your (.+?) into your hand\.$/,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate),
          async (game, target) => {
            if (!target.isPokemon) return;
            await game.AttackingPlayer.returnPokemonToHand(target);
          }
        );
      },
    },

    // Pokemon-playing effects
    {
      pattern: /^Put a Basic Pokémon from your opponent’s discard pile onto their Bench.$/,
      transform: () => {
        effect.condition = (game) =>
          game.DefendingPlayer.Bench.some((slot) => !slot.isPokemon) &&
          game.DefendingPlayer.Discard.some(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          );
        effect.effect = async (game: Game) => {
          const benchIndex = game.DefendingPlayer.Bench.findIndex((slot) => !slot.isPokemon);
          if (benchIndex < 0) return;
          const validCards = game.DefendingPlayer.Discard.filter(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          );
          const card = await game.chooseCard(game.AttackingPlayer, validCards);
          if (!card) return;
          await game.DefendingPlayer.putPokemonOnBench(card as PokemonCard, benchIndex, card);
        };
      },
    },
    {
      pattern:
        /^Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1. You can’t use this card during your first turn or on a Basic Pokémon that was put into play this turn.$/,
      transform: () => {
        convertToTargetedEffect(
          (game) => {
            const validBasicNames = game.AttackingPlayer.Hand.filter(
              (card) => card.CardType === "Pokemon" && card.Stage == 2
            )
              .map((card) => findBasicForStage2(card as PokemonCard))
              .filter((name) => name !== null);

            return game.AttackingPlayer.InPlayPokemon.filter(
              (p) => p.Stage == 0 && p.ReadyToEvolve && validBasicNames.includes(p.Name)
            );
          },
          async (game, target) => {
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
          }
        );
      },
    },
    {
      pattern:
        /Play this card as if it were a (\d+)-HP Basic \{(\w)\} Pokémon\. At any time during your turn, you may discard this card from play\. This card can’t retreat\./i,
      transform: (_, hp, type) => {
        const fullType = parseEnergy(type);

        convertToTargetedEffect(
          (game) => game.AttackingPlayer.Bench.filter((slot) => !slot.isPokemon),
          async (game, benchSlot) => {
            if (benchSlot.isPokemon) return;
            const card = game.ActiveTrainerCard as FossilCard;

            await game.putFossilOnBench(card, benchSlot.index, Number(hp), fullType);
          }
        );
      },
    },

    // Other effects
    {
      pattern: /Discard all Pokémon Tool cards attached to each of your opponent’s Pokémon\./i,
      transform: () => {
        effect.condition = (game) =>
          game.DefendingPlayer.InPlayPokemon.some((p) => p.AttachedToolCards.length > 0);
        effect.effect = async (game: Game) => {
          for (const pokemon of game.DefendingPlayer.InPlayPokemon) {
            await game.discardPokemonTools(pokemon);
          }
        };
      },
    },
  ];

  mainloop: while (cardText) {
    for (const { pattern, transform } of dictionary) {
      const result = cardText.match(pattern);
      if (result) {
        transform(...result);
        cardText = cardText.replace(pattern, "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified ability text
      }
    }

    parseSuccessful = false;
    break;
  }

  return {
    parseSuccessful,
    value: effect,
  };
};
