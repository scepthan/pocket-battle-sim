import type { Game } from "../gamelogic";
import { type BasicEffect, type Energy, parseEnergy, type PlayingCard } from "../types";
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
      pattern: /^If your opponent's Active Pokémon has damage on it, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const active = game.DefendingPlayer.activeOrThrow();
          // TODO: need to implement a separate "MaxHP" property for capes
          if (active.CurrentHP < active.BaseHP) await conditionalEffect(game);
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
          if (active.CurrentHP < active.BaseHP) await conditionalEffect(game);
          else await defaultEffect(game);
        };
      },
    },
    {
      pattern: /^If your opponent's Active Pokémon is Poisoned, (.+?\.)$/i,
      transform: (_, effectText) => {
        const conditionalEffect = recursiveParse(effectText);

        return async (game: Game) => {
          const defender = game.DefendingPlayer.activeOrThrow();
          if (defender.SecondaryConditions.has("Poisoned")) await conditionalEffect(game);
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
          const energy = game.AttackingPlayer.activeOrThrow().AttachedEnergy;
          const totalFlips = energy.filter(predicate).length;
          const { heads } = game.AttackingPlayer.flipMultiCoins(totalFlips);
          game.attackActivePokemon(heads * Number(damage));
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+) more damage for each Energy attached to your opponent's Active Pokémon\.$/i,
      transform: (_, extraDamage) => async (game: Game) => {
        const energyCount = game.DefendingPlayer.activeOrThrow().AttachedEnergy.length;
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
        /^1 of your opponent's Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\.$/i,
      transform: (_, times, damage) => async (game: Game) => {
        const damages = game.DefendingPlayer.InPlayPokemon.map(() => 0);
        for (let i = 0; i < Number(times); i++) {
          damages[Math.floor(Math.random() * damages.length)] += Number(damage);
        }
        for (let i = 0; i < damages.length; i++) {
          if (damages[i] > 0) {
            game.attackPokemon(game.DefendingPlayer.InPlayPokemon[i], damages[i]);
          }
        }
      },
    },

    // Damage to opponent's bench
    {
      pattern: /^This attack also does (\d+) damage to each of your opponent's Benched Pokémon\.$/i,
      transform: (_, benchDamage) => async (game: Game) => {
        await defaultEffect(game);
        for (const pokemon of game.DefendingPlayer.BenchedPokemon) {
          game.attackPokemon(pokemon, Number(benchDamage));
        }
      },
    },
    {
      pattern: /^This attack does (\d+) damage to 1 of your opponent's( Benched)? Pokémon\.$/i,
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
        await defaultEffect(game);
        const pokemon = await game.choosePokemon(
          game.AttackingPlayer,
          game.AttackingPlayer.BenchedPokemon
        );
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
        /^Heal from this Pokémon the same amount of damage you did to your opponent's Active Pokémon\.$/i,
      transform: () => async (game: Game) => {
        const damageDealt = game.attackActivePokemon(baseAttackHP);
        game.healPokemon(game.AttackingPlayer.activeOrThrow(), damageDealt);
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
      pattern: /^discard a random card from your opponent's hand\.$/i,
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
      pattern: /^Discard a random Energy from your opponent's Active Pokémon.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.discardRandomEnergy(game.DefendingPlayer.activeOrThrow());
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

    // Switching effects
    {
      pattern: /^Switch this Pokémon with 1 of your Benched Pokémon\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.swapActivePokemon(game.AttackingPlayer, "selfEffect");
      },
    },
    {
      pattern: /^Switch out your opponent's Active Pokémon to the Bench\./i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
      },
    },
    {
      pattern: /^your opponent shuffles their Active Pokémon back into their deck\./i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.shufflePokemonIntoDeck(game.DefendingPlayer.activeOrThrow());
      },
    },

    // Special Condition effects
    {
      pattern: /^Your opponent's active Pokémon is now Poisoned\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.poisonActivePokemon();
      },
    },
    {
      pattern: /^Your opponent's active Pokémon is now Asleep\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.sleepActivePokemon();
      },
    },
    {
      pattern: /^Your opponent's active Pokémon is now Paralyzed\.$/i,
      transform: () => async (game: Game) => {
        await defaultEffect(game);
        game.DefendingPlayer.paralyzeActivePokemon();
      },
    },

    // Other status effects
    {
      pattern:
        /^During your opponent's next turn, this Pokémon takes -(\d+) damage from attacks\.$/i,
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
        /^During your opponent's next turn, attacks used by the Defending Pokémon do -(\d+) damage\.$/i,
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
        /^(?:the Defending Pokémon can't attack ?|during your opponent's next turn(?:, )?){2}\.$/i,
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

    // Miscellaneous
    {
      pattern:
        /^Choose 1 of your opponent's Pokémon's attacks and use it as this attack\. If this Pokémon doesn't have the necessary Energy to use that attack, this attack does nothing\.$/i,
      transform: () => async (game: Game) => {
        const chosenPokemon = await game.choosePokemon(
          game.AttackingPlayer,
          game.DefendingPlayer.InPlayPokemon
        );
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
        if (
          game.AttackingPlayer.activeOrThrow().hasSufficientEnergy(chosenAttack.RequiredEnergy) &&
          !chosenAttack.Text?.includes("use it as this attack")
        ) {
          await game.useEffect(chosenAttack.Effect);
        } else {
          game.GameLog.attackFailed(game.AttackingPlayer);
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
