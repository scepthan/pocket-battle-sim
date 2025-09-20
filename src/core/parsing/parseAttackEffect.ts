import {
  InPlayPokemonCard,
  parseEnergy,
  type BasicEffect,
  type Energy,
  type Game,
  type PlayingCard,
  type PokemonCard,
} from "../gamelogic";
import { randomElement } from "../util";
import { parsePlayingCardPredicate } from "./parsePredicates";
import type { ParsedResult } from "./types";

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => BasicEffect;
}

export const parseAttackEffect = (
  effect: string,
  baseAttackHP: number,
  requiredEnergy: Energy[]
): ParsedResult<BasicEffect> => {
  let parseSuccessful = true;

  // A shorthand for applying the base attack damage (as specified by the number next to the attack on the card).
  // You should usually call this first, unless the attack does no damage or can have a modified damage amount.
  const defaultEffect =
    baseAttackHP > 0
      ? async (game: Game) => {
          game.attackActivePokemon(baseAttackHP);
        }
      : async () => {};

  // A recursive function to parse nested effects, allowing for conditional effects and other complex structures.
  const recursiveParse = (effectText: string) => {
    const result = parseAttackEffect(effectText, baseAttackHP, requiredEnergy);
    if (!result.parseSuccessful) {
      parseSuccessful = false;
    }
    return result.value;
  };

  const dictionary: EffectTransformer[] = [
    // Conditional effects
    {
      pattern: /^Flip a coin\.(?: If heads, (.+?\.))?(?: If tails, (.+?\.))?$/i,
      transform: (_, headsText, tailsText) => {
        const headsEffect = headsText ? recursiveParse(headsText) : defaultEffect;
        const tailsEffect = tailsText ? recursiveParse(tailsText) : defaultEffect;

        return async (game: Game) => {
          if (game.AttackingPlayer.flipCoin()) {
            await headsEffect(game);
          } else {
            await tailsEffect(game);
          }
        };
      },
    },
    {
      pattern: /^Flip 2 coins. If both of them are heads, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const { heads } = game.AttackingPlayer.flipMultiCoins(2);
          if (heads == 2) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If this Pokémon has at least (\d+) extra (?:{(\w)} )?Energy attached, (.+?\.)$/i,
      transform: (_, energyCount, energyType, effectText) => {
        const e = parseEnergy(energyType || "C");
        const secondaryRequiredEnergy = requiredEnergy.slice();
        for (let i = 0; i < Number(energyCount); i++) secondaryRequiredEnergy.push(e);

        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          if (active.hasSufficientEnergy(secondaryRequiredEnergy)) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has damage on it, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const active = game.DefendingPlayer.activeOrThrow();
          if (active.isDamaged()) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If this Pokémon has damage on it, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          if (active.isDamaged()) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is Poisoned, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const defender = game.DefendingPlayer.activeOrThrow();
          if (defender.SecondaryConditions.has("Poisoned")) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is a Pokémon ex, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const defender = game.DefendingPlayer.activeOrThrow();
          if (defender.Name.endsWith(" ex")) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern:
        /^If any of your Pokémon were knocked out by damage from an attack during your opponent’s last turn, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          if (game.GameLog.turns[1]?.some((e) => e.type == "pokemonKnockedOut" && e.fromAttack))
            await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },

    // Damage-determining effects
    {
      pattern: /^Flip (\d+) coins\. This attack does (\d+)( more)? damage for each heads\.$/i,
      transform: (_, coins, damage, more) => async (game: Game) => {
        let totalDamage = more ? baseAttackHP : 0;
        const { heads } = game.AttackingPlayer.flipMultiCoins(Number(coins));
        totalDamage += heads * Number(damage);
        game.attackActivePokemon(totalDamage);
      },
    },
    {
      pattern:
        /^Flip a coin until you get tails\. This attack does (\d+)( more)? damage for each heads\.$/i,
      transform: (_, damage, more) => async (game: Game) => {
        let totalDamage = more ? baseAttackHP : 0;
        const { heads } = game.AttackingPlayer.flipUntilTails();
        totalDamage += heads * Number(damage);
        game.attackActivePokemon(totalDamage);
      },
    },
    {
      pattern:
        /^Flip a coin for each(?: {(\w)})? Energy attached to this Pokémon\. This attack does (\d+) damage for each heads\.$/i,
      transform: (_, energyType, damage) => {
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        const predicate = fullType ? (e: Energy) => e == fullType : () => true;

        return async (game: Game) => {
          const energy = game.AttackingPlayer.activeOrThrow().EffectiveEnergy;
          const totalFlips = energy.filter(predicate).length;
          const { heads } = game.AttackingPlayer.flipMultiCoins(totalFlips);
          game.attackActivePokemon(heads * Number(damage));
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+) more damage for each Energy attached to your opponent’s Active Pokémon\.$/i,
      transform: (_, extraDamage) => async (game: Game) => {
        const energyCount = game.DefendingPlayer.activeOrThrow().EffectiveEnergy.length;
        const damage = baseAttackHP + Number(extraDamage) * energyCount;
        game.attackActivePokemon(damage);
      },
    },
    {
      pattern: /^this attack does nothing\.$/i,
      transform: () => async (game: Game) => {
        game.GameLog.attackFailed(game.AttackingPlayer);
      },
    },
    {
      pattern: /^this attack does (\d+) more damage\.$/i,
      transform: (_, extraDamage) => async (game: Game) => {
        game.attackActivePokemon(baseAttackHP + Number(extraDamage));
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each of your Benched(?: \{(\w)\})? (.+?)\.$/i,
      transform: (_, damagePerBench, more, type, pokemon) => {
        const e = type ? parseEnergy(type) : undefined;

        return async (game: Game) => {
          let totalDamage = more ? baseAttackHP : 0;
          const bench = game.AttackingPlayer.BenchedPokemon.filter(
            (p) => (!e || p.Type == e) && (pokemon == "Pokémon" || p.Name == pokemon)
          );
          totalDamage += bench.length * Number(damagePerBench);
          game.attackActivePokemon(totalDamage);
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each of your opponent’s Benched Pokémon\.$/i,
      transform: (_, damagePerBench, more) => {
        return async (game: Game) => {
          let totalDamage = more ? baseAttackHP : 0;
          totalDamage += game.DefendingPlayer.BenchedPokemon.length * Number(damagePerBench);
          game.attackActivePokemon(totalDamage);
        };
      },
    },
    {
      pattern:
        /^1 of your opponent’s Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\.$/i,
      transform: (_, times, damage) => async (game: Game) => {
        const damages = game.DefendingPlayer.InPlayPokemon.map((p) => ({ pokemon: p, damage: 0 }));
        for (let i = 0; i < Number(times); i++) {
          randomElement(damages).damage += Number(damage);
        }
        for (const { pokemon, damage } of damages) {
          if (damage > 0) game.attackPokemon(pokemon, damage);
        }
      },
    },

    // Damage to opponent’s bench
    {
      pattern: /^This attack also does (\d+) damage to each of your opponent’s Benched Pokémon\.$/i,
      transform: (_, benchDamage) => async (game: Game) => {
        await defaultEffect(game);
        for (const pokemon of game.DefendingPlayer.BenchedPokemon) {
          game.attackPokemon(pokemon, Number(benchDamage));
        }
      },
    },
    {
      pattern: /^This attack does (\d+) damage to 1 of your opponent’s( Benched)? Pokémon\.$/i,
      transform: (_, damage, benched) => async (game: Game) => {
        const pokemon = await game.choosePokemon(
          game.AttackingPlayer,
          benched ? game.DefendingPlayer.BenchedPokemon : game.DefendingPlayer.InPlayPokemon
        );
        if (pokemon) {
          game.attackPokemon(pokemon, Number(damage));
        }
      },
    },

    // Self damage
    {
      pattern: /^This Pokémon also does (\d+) damage to itself\.$/i,
      transform: (_, selfDamage) => async (game: Game) => {
        await defaultEffect(game);
        game.applyDamage(game.AttackingPlayer.activeOrThrow(), Number(selfDamage), true);
      },
    },
    {
      pattern: /^This attack also does (\d+) damage to 1 of your Benched Pokémon\.$/i,
      transform: (_, damage) => async (game: Game) => {
        const pokemon = await game.choosePokemon(
          game.AttackingPlayer,
          game.AttackingPlayer.BenchedPokemon
        );
        await defaultEffect(game);
        if (pokemon) {
          game.attackPokemon(pokemon, Number(damage));
        }
      },
    },

    // Healing effects
    {
      pattern: /^Heal (\d+) damage from this Pokémon\.$/,
      transform: (_, HP) => async (game: Game) => {
        await defaultEffect(game);
        game.healPokemon(game.AttackingPlayer.activeOrThrow(), Number(HP));
      },
    },
    {
      pattern:
        /^Heal from this Pokémon the same amount of damage you did to your opponent’s Active Pokémon\.$/i,
      transform: () => async (game: Game) => {
        const damageDealt = game.attackActivePokemon(baseAttackHP);
        game.healPokemon(game.AttackingPlayer.activeOrThrow(), damageDealt);
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your Pokémon\.$/,
      transform: (_, HP) => async (game: Game) => {
        await defaultEffect(game);
        for (const pokemon of game.AttackingPlayer.InPlayPokemon) {
          if (pokemon.isDamaged()) game.healPokemon(pokemon, Number(HP));
        }
      },
    },

    // Draw effects
    {
      pattern: /^Draw (a|\d+) cards?\.$/i,
      transform: (_, count) => async (game: Game) => {
        await defaultEffect(game);
        game.drawCards(count == "a" ? 1 : Number(count));
      },
    },
    {
      pattern:
        /^Shuffle your hand into your deck. Draw a card for each card in your opponent’s hand.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.AttackingPlayer.shuffleHandIntoDeck();
        game.drawCards(game.DefendingPlayer.Hand.length);
      },
    },
    {
      pattern: /^Put 1 random(?: \{(\w)\})? Pokémon from your deck into your hand\.$/i,
      transform: (_, type) => {
        const e = type ? parseEnergy(type) : undefined;

        const predicate = e
          ? (card: PlayingCard) => card.CardType == "Pokemon" && card.Type == e
          : (card: PlayingCard) => card.CardType == "Pokemon";

        return async (game: Game) => {
          await defaultEffect(game);
          game.AttackingPlayer.drawRandomFiltered(predicate);
        };
      },
    },
    {
      pattern: /^Put 1 random (.+?) from your deck onto your bench\.$/i,
      transform: (_, specifier) => {
        const predicate = parsePlayingCardPredicate(specifier);

        return async (game: Game) => {
          await defaultEffect(game);

          const benchSlot = game.AttackingPlayer.Bench.find((s) => !s.isPokemon);
          if (benchSlot === undefined) {
            game.GameLog.benchFull(game.AttackingPlayer);
            return;
          }

          const card = game.AttackingPlayer.drawRandomFiltered(predicate);
          if (card === undefined) return;

          await game.AttackingPlayer.putPokemonOnBench(card as PokemonCard, benchSlot.index);
        };
      },
    },
    {
      pattern: /^discard a random card from your opponent’s hand\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.discardRandomFiltered();
      },
    },
    {
      pattern: /^Your opponent reveals their hand\.$/,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
      },
    },

    // Energy effects
    {
      pattern: /^Discard (a|\d+) \{(\w)\} Energy from this Pokémon\.$/i,
      transform: (_, count, energyType) => {
        const fullType = parseEnergy(energyType);

        return async (game: Game) => {
          await defaultEffect(game);
          game.discardEnergy(game.AttackingPlayer.activeOrThrow(), fullType, Number(count) || 1);
        };
      },
    },
    {
      pattern: /^Discard all Energy from this Pokémon\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.discardAllEnergy(game.AttackingPlayer.activeOrThrow());
      },
    },
    {
      pattern:
        /^Discard (a|\d+|all) \{(\w)\} Energy from this Pokémon\. This attack does (\d+) damage to 1 of your opponent’s Pokémon\.$/i,
      transform: (_, count, energyType, damage) => {
        const fullType = parseEnergy(energyType);
        const numToDiscard = count == "all" ? Infinity : count == "a" ? 1 : Number(count);

        return async (game: Game) => {
          const pokemon = await game.choosePokemon(
            game.AttackingPlayer,
            game.DefendingPlayer.InPlayPokemon
          );
          if (!pokemon) return;
          game.attackPokemon(pokemon, Number(damage));
          game.discardEnergy(game.AttackingPlayer.activeOrThrow(), fullType, numToDiscard);
        };
      },
    },
    {
      pattern: /^Discard a random Energy from your opponent’s Active Pokémon.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.discardRandomEnergy(game.DefendingPlayer.activeOrThrow());
      },
    },
    {
      pattern:
        /^Discard a random Energy from among the Energy attached to all Pokémon \(both yours and your opponent’s\)\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        const allPokemon = [
          ...game.AttackingPlayer.InPlayPokemon,
          ...game.DefendingPlayer.InPlayPokemon,
        ];
        const allEnergy: { pokemon: InPlayPokemonCard; energy: Energy }[] = [];
        for (const p of allPokemon) {
          for (const e of p.AttachedEnergy) {
            allEnergy.push({ pokemon: p, energy: e });
          }
        }
        const { pokemon, energy } = randomElement(allEnergy);
        game.discardEnergy(pokemon, energy, 1);
      },
    },
    {
      pattern:
        /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to this Pokémon\.$/i,
      transform: (_, count, type) => {
        const fullType = parseEnergy(type);

        return async (game: Game) => {
          await defaultEffect(game);
          game.AttackingPlayer.attachEnergy(
            game.AttackingPlayer.activeOrThrow(),
            new Array(count == "a" ? 1 : Number(count)).fill(fullType),
            "energyZone"
          );
        };
      },
    },
    {
      pattern:
        /^Take a \{(\w)\} Energy from your Energy Zone and attach it to 1 of your( Benched)?(?: \{(\w)\})? Pokémon\.$/i,
      transform: (_, energyType, benched, pokemonType) => {
        const et = parseEnergy(energyType);
        const pt = pokemonType ? parseEnergy(pokemonType) : undefined;

        return async (game: Game) => {
          await defaultEffect(game);
          const validPokemon = (
            benched ? game.AttackingPlayer.BenchedPokemon : game.AttackingPlayer.InPlayPokemon
          ).filter((x) => !pt || x.Type == pt);
          const pokemon = await game.choosePokemon(game.AttackingPlayer, validPokemon);
          if (pokemon) {
            game.AttackingPlayer.attachEnergy(pokemon, [et], "energyZone");
          }
        };
      },
    },
    {
      pattern:
        /^Flip (\d+) coins\. Take an amount of \{(\w)\} Energy from your Energy Zone equal to the number of heads and attach it to your Benched(?: \{(\w)\})? Pokémon in any way you like\.$/i,
      transform: (_, coins, energyType, pokemonType) => {
        const et = parseEnergy(energyType);
        const pt = pokemonType ? parseEnergy(pokemonType) : undefined;

        return async (game: Game) => {
          await defaultEffect(game);
          const { heads } = game.AttackingPlayer.flipMultiCoins(Number(coins));
          if (heads == 0) return;
          const validPokemon = game.AttackingPlayer.BenchedPokemon.filter(
            (x) => !pt || x.Type == pt
          );
          if (validPokemon.length == 0) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }
          await game.distributeEnergy(
            game.AttackingPlayer,
            new Array(heads).fill(et),
            validPokemon
          );
        };
      },
    },

    // Switching effects
    {
      pattern: /^Switch this Pokémon with 1 of your Benched Pokémon\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.swapActivePokemon(game.AttackingPlayer, "selfEffect");
      },
    },
    {
      pattern: /^Switch out your opponent’s Active Pokémon to the Bench\./i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
      },
    },
    {
      pattern: /^your opponent shuffles their Active Pokémon into their deck\./i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.DefendingPlayer.shufflePokemonIntoDeck(game.DefendingPlayer.activeOrThrow());
      },
    },

    // Special Condition effects
    {
      pattern: /^Your opponent’s active Pokémon is now Poisoned\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.poisonActivePokemon();
      },
    },
    {
      pattern: /^Your opponent’s active Pokémon is now Asleep\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.sleepActivePokemon();
      },
    },
    {
      pattern: /^Your opponent’s active Pokémon is now Paralyzed\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.paralyzeActivePokemon();
      },
    },

    // Other status effects
    {
      pattern:
        /^During your opponent’s next turn, this Pokémon takes −(\d+) damage from attacks\.$/i,
      transform: (_, damageReduction) => async (game: Game) => {
        await defaultEffect(game);
        game.AttackingPlayer.applyActivePokemonStatus({
          type: "ReduceDamage",
          amount: Number(damageReduction),
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },
    {
      pattern:
        /^during your opponent’s next turn, prevent all damage from—and effects of—attacks done to this Pokémon\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.AttackingPlayer.applyActivePokemonStatus({
          type: "PreventDamage",
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, attacks used by the Defending Pokémon do −(\d+) damage\.$/i,
      transform: (_, damageReduction) => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.applyActivePokemonStatus({
          type: "ReduceAttack",
          amount: Number(damageReduction),
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },
    {
      // Vulpix and Omastar have the same phrase in opposite order, so we account for both arrangements
      pattern:
        /^(?:the Defending Pokémon can’t attack ?|during your opponent’s next turn(?:, )?){2}\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.applyActivePokemonStatus({
          type: "CannotAttack",
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },
    {
      pattern: /^During your opponent’s next turn, the Defending Pokémon can’t retreat\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.applyActivePokemonStatus({
          type: "CannotRetreat",
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },
    {
      pattern:
        /^Your opponent can’t use any Supporter cards from their hand during their next turn\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.applyStatus({
          type: "CannotUseSupporter",
          source: "Effect",
          category: "GameRule",
          keepNextTurn: true,
        });
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, if the Defending Pokémon tries to use an attack, your opponent flips a coin. If tails, that attack doesn’t happen.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.applyActivePokemonStatus({
          type: "CoinFlipToAttack",
          source: "Effect",
          condition: "none",
          keepNextTurn: true,
        });
      },
    },

    // Miscellaneous
    {
      pattern:
        /^Choose 1 of your opponent’s( Active)? Pokémon’s attacks and use it as this attack\.( If this Pokémon doesn’t have the necessary Energy to use that attack, this attack does nothing\.)?$/i,
      transform: (_, active, energyRequired) => async (game: Game) => {
        const chosenPokemon = active
          ? game.DefendingPlayer.activeOrThrow()
          : await game.choosePokemon(game.AttackingPlayer, game.DefendingPlayer.InPlayPokemon);
        if (!chosenPokemon) {
          game.GameLog.attackFailed(game.AttackingPlayer);
          return;
        }
        const chosenAttack = await game.choose(game.AttackingPlayer, chosenPokemon.Attacks);
        if (!chosenAttack) {
          game.GameLog.attackFailed(game.AttackingPlayer);
          return;
        }
        game.GameLog.copyAttack(game.AttackingPlayer, chosenAttack.Name);
        let attackFailed = chosenAttack.Text?.includes("use it as this attack");
        if (energyRequired) {
          const active = game.AttackingPlayer.activeOrThrow();
          if (!active.hasSufficientEnergy(chosenAttack.RequiredEnergy)) attackFailed = true;
        }
        if (attackFailed) {
          game.GameLog.attackFailed(game.AttackingPlayer);
        } else {
          await game.useEffect(chosenAttack.Effect);
        }
      },
    },
  ];

  for (const { pattern, transform } of dictionary) {
    const result = effect.match(pattern);

    if (result) {
      const Effect = transform(...result);
      return {
        parseSuccessful,
        value: Effect,
      };
    }
  }
  return {
    parseSuccessful: false,
    value: defaultEffect,
  };
};
