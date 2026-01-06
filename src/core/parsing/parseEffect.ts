import {
  InPlayPokemon,
  parseEnergy,
  type CoinFlipIndicator,
  type DamageCalculation,
  type Energy,
  type Game,
  type SideEffect,
} from "../gamelogic";
import { randomElement } from "../util";
import {
  parsePlayingCardPredicate as _cardParse,
  parsePokemonPredicate as _pokemonParse,
  type InPlayPokemonPredicate,
} from "./parsePredicates";
import type { ParsedResult } from "./types";

export interface Effect {
  type:
    | "CoinFlipOrDoNothing"
    | "CoinFlipForDamage"
    | "CoinFlipForAddedDamage"
    | "PredeterminableDamage"
    | "NoBaseDamage";

  /**
   * Determines how many coins to flip for the effect. There are 3 options:
   * 1. A number, which flips that many coins.
   * 2. "UntilTails", which flips a coin until it lands on tails.
   * 3. A method that calculates how many coins to flip based on the game state.
   *
   * This flip happens before any damage is dealt for attack types of "CoinFlipForDamage",
   * "CoinFlipForAddedDamage", or "CoinFlipOrDoNothing", and after for "NoBaseDamage" or
   * "PredeterminableDamage".
   */
  coinsToFlip?: CoinFlipIndicator;

  /**
   * A method that calculates the base damage of the attack to be applied to the Defending Pokémon.
   * This method should not have any side effects.
   */
  calculateDamage?: DamageCalculation;

  /**
   * A method that determines which Pokémon the player can choose to target for any side effects,
   * such as dealing Bench damage to the opponent or healing an own Pokémon.
   */
  validTargets?: (game: Game, self: InPlayPokemon) => InPlayPokemon[];

  /**
   * Effects to apply when attacking before any damage is done.
   */
  preDamageEffects: SideEffect[];

  /**
   * Damage-dealing effects of an attack other than dealing base damage to the Defending Pokémon.
   */
  attackingEffects: SideEffect[];

  /**
   * Non-damage-dealing effects of an attack; all effects of a Trainer or Ability.
   */
  sideEffects: SideEffect[];

  /**
   * Extraneous conditions that must be met for the effect to be used (other than the default
   * Energy and status condition requirements for attacks).
   */
  explicitConditions: ((game: Game, self: InPlayPokemon) => boolean)[];

  /**
   * Conditions that must be met for a Trainer or Ability with this effect to be used.
   */
  implicitConditions: ((game: Game, self: InPlayPokemon) => boolean)[];
}

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}

/**
 * Creates a SideEffect that does a given amount of damage to the target Pokémon, if given.
 * @param damage Damage to do to the target Pokémon
 * @returns SideEffect that will damage target if it exists
 */
const attackTargetIfExists: (damage: number) => SideEffect =
  (damage: number) => async (game, self, heads, target) => {
    if (!target) return;
    game.attackPokemon(target, damage);
  };

export const parseEffect = (
  text: string,
  baseDamage?: number,
  requiredEnergy?: Energy[]
): ParsedResult<Effect> => {
  let parseSuccessful = true;
  let conditionalForNextEffect:
    | ((game: Game, self: InPlayPokemon, heads: number) => boolean)
    | undefined = undefined;
  baseDamage = baseDamage ?? 0;

  const effect: Effect = {
    type: baseDamage === undefined ? "NoBaseDamage" : "PredeterminableDamage",
    preDamageEffects: [],
    attackingEffects: [],
    sideEffects: [],
    explicitConditions: [],
    implicitConditions: [],
  };

  /**
   * Takes an effect and returns a new one that only runs if the previously parsed condition is met.
   *
   * As an example: "Flip a coin. If heads, discard a random card from your opponent's hand."
   *
   * The "If heads," is parsed and stored as conditionalForNextEffect. The parser for "discard a
   * random card" can then call this method to only apply if the coin flip results in heads.
   */
  const applyConditionalIfAvailable: (effect: SideEffect) => SideEffect = (effect) => {
    if (conditionalForNextEffect) {
      const prevConditional = conditionalForNextEffect;
      conditionalForNextEffect = undefined;
      return async (game, self, heads, target) => {
        if (prevConditional(game, self, heads)) await effect(game, self, heads, target);
      };
    }
    return effect;
  };

  const addSideEffect = (sideEffect: SideEffect) => {
    effect.sideEffects.push(applyConditionalIfAvailable(sideEffect));
  };

  const parsePokemonPredicate = (descriptor: string, predicate?: InPlayPokemonPredicate) => {
    const { parseSuccessful: success, value } = _pokemonParse(descriptor, predicate);
    if (!success) parseSuccessful = false;
    return value;
  };
  const parsePlayingCardPredicate = (descriptor: string) => {
    const { parseSuccessful: success, value } = _cardParse(descriptor);
    if (!success) parseSuccessful = false;
    return value;
  };

  const dictionary: EffectTransformer[] = [
    // Coin flipping
    {
      pattern: /^Flip (a|\d+) coins?\./i,
      transform: (_, count) => {
        effect.coinsToFlip = count === "a" ? 1 : Number(count);
      },
    },
    {
      pattern: /^Flip a coin until you get tails\./i,
      transform: () => {
        effect.coinsToFlip = "UntilTails";
      },
    },
    {
      pattern: /^Flip a coin for each(?: \{(\w)\})? Energy attached to this Pokémon\./i,
      transform: (_, type) => {
        const fullType = type ? parseEnergy(type) : undefined;
        const predicate = fullType ? (e: Energy) => e == fullType : () => true;
        effect.coinsToFlip = (game, self) => self.EffectiveEnergy.filter(predicate).length;
      },
    },
    {
      pattern: /^Flip a coin for each Pokémon you have in play\./i,
      transform: () => {
        effect.coinsToFlip = (game) => game.AttackingPlayer.InPlayPokemon.length;
      },
    },

    // Set the type based on what we're doing with the coin flips
    // CoinFlipOrDoNothing
    {
      pattern: /^If tails, this attack does nothing\./i,
      transform: () => {
        effect.type = "CoinFlipOrDoNothing";
      },
    },

    // CoinFlipForDamage
    {
      pattern: /^This attack does (\d+) damage for each heads\./i,
      transform: (_, damage) => {
        effect.type = "CoinFlipForDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => heads * dmg;
      },
    },

    // CoinFlipForAddedDamage
    {
      pattern: /^This attack does (\d+) more damage for each heads\./i,
      transform: (_, damage) => {
        effect.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + heads * dmg;
      },
    },
    {
      pattern: /^If heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + (heads > 0 ? dmg : 0);
      },
    },
    {
      pattern: /^If both of them are heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + (heads > 1 ? dmg : 0);
      },
    },

    {
      pattern: /^If this Pokémon has at least (\d+) extra (?:\{(\w)\} )?Energy attached,/i,
      transform: (_, energyCount, energyType) => {
        const e = parseEnergy(energyType || "C");
        if (!requiredEnergy) throw new Error("Could not determine required Energy for attack");
        const secondaryRequiredEnergy = requiredEnergy.slice();
        for (let i = 0; i < Number(energyCount); i++) secondaryRequiredEnergy.push(e);

        conditionalForNextEffect = (game, self) =>
          self.hasSufficientEnergy(secondaryRequiredEnergy);
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has damage on it,/i,
      transform: () => {
        conditionalForNextEffect = (game) => game.DefendingPlayer.activeOrThrow().isDamaged();
      },
    },
    {
      pattern: /^If this Pokémon has damage on it,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.isDamaged();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has more remaining HP than this Pokémon,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) =>
          game.DefendingPlayer.activeOrThrow().CurrentHP > self.CurrentHP;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is Poisoned,/i,
      transform: () => {
        conditionalForNextEffect = (game) => game.DefendingPlayer.activeOrThrow().isPoisoned();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is affected by a Special Condition,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.DefendingPlayer.activeOrThrow().hasSpecialCondition();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is a ([^,]+?),/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        conditionalForNextEffect = (game) => predicate(game.DefendingPlayer.activeOrThrow());
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has an Ability,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.DefendingPlayer.activeOrThrow().Ability !== undefined;
      },
    },
    {
      pattern:
        /^If any of your Pokémon were knocked out by damage from an attack during your opponent’s last turn,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.GameLog.previousTurn?.some((e) => e.type == "pokemonKnockedOut" && e.fromAttack) ??
          false;
      },
    },
    {
      pattern: /^If any of your (.+?) have damage on them,/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        conditionalForNextEffect = (game) => game.AttackingPlayer.InPlayPokemon.some(predicate);
      },
    },
    {
      pattern: /^If this Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.DefendingPlayer.activeOrThrow().AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If your opponent’s Pokémon is knocked out by damage from this attack,/i,
      transform: () => {
        conditionalForNextEffect = (game) => {
          const damageEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "pokemonDamaged"
          );
          const activeAttackEvent = damageEvents.find(
            (event) =>
              event.player === game.DefendingPlayer.Name &&
              event.targetPokemon.location === "active" &&
              event.fromAttack
          );
          if (!activeAttackEvent) return false;
          return activeAttackEvent.finalHP === 0;
        };
      },
    },
    {
      pattern: /^If this Pokémon moved from your Bench to the Active Spot this turn,/i,
      transform: () => {
        conditionalForNextEffect = (game) => {
          const damageEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "selectActivePokemon" || event.type === "swapActivePokemon"
          );
          return damageEvents.some((event) => event.player === game.AttackingPlayer.Name);
        };
      },
    },
    {
      pattern: /^If heads,/i,
      transform: () => {
        conditionalForNextEffect = (game, self, heads) => heads > 0;
      },
    },
    {
      pattern: /^If at least (\d+) of them (?:is|are) heads,/i,
      transform: (_, headsNeeded) => {
        conditionalForNextEffect = (game, self, heads) => heads >= Number(headsNeeded);
      },
    },
    {
      pattern: /^If tails,/i,
      transform: () => {
        conditionalForNextEffect = (game, self, heads) => heads === 0;
      },
    },

    // Damage-determining effects
    {
      pattern: /^this attack does (\d+) more damage\./i,
      transform: (_, extraDamage) => {
        if (conditionalForNextEffect === undefined) {
          parseSuccessful = false;
          return;
        }
        const prevConditional = conditionalForNextEffect;
        conditionalForNextEffect = undefined;
        effect.calculateDamage = (game, self) =>
          baseDamage + (prevConditional(game, self, 0) ? Number(extraDamage) : 0);
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each Energy attached to your opponent’s Active Pokémon\./i,
      transform: (_, damagePerEnergy, more) => {
        effect.calculateDamage = (game) => {
          const energyCount = game.DefendingPlayer.activeOrThrow().EffectiveEnergy.length;
          return (more ? baseDamage : 0) + energyCount * Number(damagePerEnergy);
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each of your opponent’s Benched Pokémon\./i,
      transform: (_, damagePerBench, more) => {
        effect.calculateDamage = (game) => {
          const benchedCount = game.DefendingPlayer.BenchedPokemon.length;
          return (more ? baseDamage : 0) + benchedCount * Number(damagePerBench);
        };
      },
    },
    {
      pattern: /^This attack does (\d+)( more)? damage for each of your ([^.]+)\./i,
      transform: (_, damageEach, more, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.calculateDamage = (game) => {
          const pokemonCount = game.AttackingPlayer.InPlayPokemon.filter(predicate).length;
          return (more ? baseDamage : 0) + pokemonCount * Number(damageEach);
        };
      },
    },
    {
      pattern: /^This attack does more damage equal to the damage this Pokémon has on it\./i,
      transform: () => {
        effect.calculateDamage = (game, self) => baseDamage + self.currentDamage();
      },
    },
    {
      pattern: /^1 of your opponent’s Pokémon is chosen at random\. Do (\d+) damage to it\./i,
      transform: (_, damage) => {
        effect.attackingEffects.push(async (game) => {
          const pokemon = randomElement(game.DefendingPlayer.InPlayPokemon);
          game.attackPokemon(pokemon, Number(damage));
        });
      },
    },
    {
      pattern:
        /^1 of your opponent’s Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\./i,
      transform: (_, times, damage) => {
        effect.attackingEffects.push(async (game) => {
          const damages = game.DefendingPlayer.InPlayPokemon.map((p) => ({
            pokemon: p,
            damage: 0,
          }));
          for (let i = 0; i < Number(times); i++) {
            randomElement(damages).damage += Number(damage);
          }
          for (const { pokemon, damage } of damages) {
            if (damage > 0) game.attackPokemon(pokemon, damage);
          }
        });
      },
    },
    {
      pattern: /^Halve your opponent’s Active Pokémon’s remaining HP, rounded down\./i,
      transform: () => {
        effect.attackingEffects.push(async (game) => {
          const defender = game.DefendingPlayer.activeOrThrow();
          const targetHp = Math.floor(defender.CurrentHP / 2 / 10) * 10;
          const damage = defender.CurrentHP - targetHp;
          // The game does not consider this to be "damage from an attack"
          game.applyDamage(defender, damage, false);
        });
      },
    },

    // Damage to opponent’s bench
    {
      pattern: /^This attack also does (\d+) damage to each of your opponent’s (Benched [^.]+?)\./i,
      transform: (_, benchDamage, descriptor) => {
        const dmg = Number(benchDamage);
        const predicate = parsePokemonPredicate(descriptor);
        const benchDamageEffect = applyConditionalIfAvailable(async (game) => {
          for (const p of game.DefendingPlayer.BenchedPokemon) {
            if (predicate(p)) game.attackPokemon(p, dmg);
          }
        });
        effect.attackingEffects.push(benchDamageEffect);
      },
    },
    {
      pattern:
        /^This attack does (\d+) damage to 1 of your opponent’s (.+?) for each Energy attached to that Pokémon\./i,
      transform: (_, damagePerEnergy, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.validTargets = (game) => game.DefendingPlayer.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(async (game, self, heads, target) => {
          if (!target) return;
          const energyCount = target.EffectiveEnergy.length;
          game.attackPokemon(target, energyCount * Number(damagePerEnergy));
        });
      },
    },
    {
      pattern: /^This attack(?: also)? does (\d+) damage to 1 of your opponent’s (.+?)\./i,
      transform: (_, damage, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.validTargets = (game) => game.DefendingPlayer.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },
    {
      pattern: /^This attack does (\d+) damage to each of your opponent’s Pokémon\./i,
      transform: (_, damage) => {
        const dmg = Number(damage);
        const attackEffect = applyConditionalIfAvailable(async (game) => {
          for (const pokemon of game.DefendingPlayer.InPlayPokemon) {
            game.attackPokemon(pokemon, dmg);
          }
        });
        effect.attackingEffects.push(attackEffect);
      },
    },

    // Self damage
    {
      pattern: /^This Pokémon also does (\d+) damage to itself\./i,
      transform: (_, selfDamage) => {
        const dmg = Number(selfDamage);
        const selfAttackEffect = applyConditionalIfAvailable(async (game, self) => {
          game.applyDamage(self, dmg, true);
        });
        effect.attackingEffects.push(selfAttackEffect);
      },
    },
    {
      pattern: /^This attack also does (\d+) damage to 1 of your (.+?)\./i,
      transform: (_, damage, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.validTargets = (game) => game.AttackingPlayer.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },

    // Healing effects
    {
      pattern: /^Heal (\d+) damage from this Pokémon\./,
      transform: (_, healing) => {
        addSideEffect(async (game, self) => self.healDamage(Number(healing)));
      },
    },
    {
      pattern:
        /^Heal from this Pokémon the same amount of damage you did to your opponent’s Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          const damageEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "pokemonDamaged"
          );
          const activeAttackEvent = damageEvents.find(
            (event) =>
              event.player === game.DefendingPlayer.Name &&
              event.targetPokemon.location === "active" &&
              event.fromAttack
          );
          if (!activeAttackEvent) return;
          self.healDamage(activeAttackEvent.damageDealt);
        });
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your Pokémon\./,
      transform: (_, HP) => {
        addSideEffect(async (game) => {
          for (const pokemon of game.AttackingPlayer.InPlayPokemon) {
            if (pokemon.isDamaged()) pokemon.healDamage(Number(HP));
          }
        });
      },
    },

    // Draw effects
    {
      pattern: /^Draw (a|\d+) cards?\./i,
      transform: (_, count) => {
        const cardCount = count == "a" ? 1 : Number(count);
        addSideEffect(async (game) => game.AttackingPlayer.drawCards(cardCount));
      },
    },
    {
      pattern:
        /^Shuffle your hand into your deck\. Draw a card for each card in your opponent’s hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.AttackingPlayer.shuffleHandIntoDeck();
          game.AttackingPlayer.drawCards(game.DefendingPlayer.Hand.length);
        });
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\./i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        addSideEffect(async (game) => {
          game.AttackingPlayer.drawRandomFilteredToHand(predicate);
        });
      },
    },
    {
      pattern: /^Put 1 random (.+?) from your deck onto your bench\./i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        addSideEffect(async (game) => {
          await game.AttackingPlayer.playRandomFilteredToBench(predicate);
        });
      },
    },
    {
      pattern: /^discard a random (.+?) from your opponent’s hand\./i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        addSideEffect(async (game) => {
          game.DefendingPlayer.discardRandomFiltered(predicate);
        });
      },
    },
    {
      pattern: /^Discard the top (\d+) cards of your deck\./i,
      transform: (_, count) => {
        addSideEffect(async (game) => {
          game.AttackingPlayer.discardTopOfDeck(Number(count));
        });
      },
    },
    {
      pattern:
        /^Your opponent reveals their hand\. Choose a card you find there and shuffle it into your opponent’s deck\./i,
      transform: () => {
        addSideEffect(async (game) => {
          const card = await game.chooseCard(game.AttackingPlayer, game.DefendingPlayer.Hand);
          if (!card) return;
          game.DefendingPlayer.returnToDeck([card]);
        });
      },
    },
    {
      pattern:
        /^your opponent reveals a random card from their hand and shuffles it into their deck\./i,
      transform: () => {
        addSideEffect(async (game) => {
          if (game.DefendingPlayer.Hand.length === 0) return;
          const card = randomElement(game.DefendingPlayer.Hand);
          await game.showCards(game.AttackingPlayer, [card]);
          game.DefendingPlayer.returnToDeck([card]);
        });
      },
    },
    {
      pattern: /^Your opponent reveals their hand\./,
      transform: () => {
        addSideEffect(async (game) => {
          await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
        });
      },
    },

    // Energy discard effects
    {
      pattern: /^Discard (a|\d+|all) \{(\w)\} Energy from this Pokémon\./i,
      transform: (_, count, energyType) => {
        const energyCount = count == "all" ? Infinity : count == "a" ? 1 : Number(count);
        const fullType = parseEnergy(energyType);

        addSideEffect(async (game, self) => game.discardEnergy(self, fullType, energyCount));
      },
    },
    {
      pattern: /^Discard (a|\d+) random Energy from this Pokémon\./i,
      transform: (_, count) => {
        const energyCount = count == "a" ? 1 : Number(count);
        addSideEffect(async (game, self) => game.discardRandomEnergy(self, energyCount));
      },
    },
    {
      pattern: /^Discard all Energy from this Pokémon\./i,
      transform: () => {
        addSideEffect(async (game, self) => game.discardAllEnergy(self));
      },
    },
    {
      pattern: /^Discard a random Energy from your opponent’s Active Pokémon\./i,
      transform: () => {
        addSideEffect(
          async (game) => await game.discardRandomEnergy(game.DefendingPlayer.activeOrThrow())
        );
      },
    },
    {
      pattern: /^Discard a random Energy from both Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.discardRandomEnergy(game.AttackingPlayer.activeOrThrow());
          await game.discardRandomEnergy(game.DefendingPlayer.activeOrThrow());
        });
      },
    },
    {
      pattern:
        /^Discard a random Energy from among the Energy attached to all Pokémon \(both yours and your opponent’s\)\./i,
      transform: () => {
        addSideEffect(async (game) => {
          const allPokemon = [
            ...game.AttackingPlayer.InPlayPokemon,
            ...game.DefendingPlayer.InPlayPokemon,
          ];
          const allEnergy: { pokemon: InPlayPokemon; energy: Energy }[] = [];
          for (const p of allPokemon) {
            for (const e of p.AttachedEnergy) {
              allEnergy.push({ pokemon: p, energy: e });
            }
          }
          const { pokemon, energy } = randomElement(allEnergy);
          await game.discardEnergy(pokemon, energy, 1);
        });
      },
    },

    // Energy generation effects
    {
      pattern:
        /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to this Pokémon\./i,
      transform: (_, count, type) => {
        const energyCount = count == "a" ? 1 : Number(count);
        const energy = new Array(energyCount).fill(parseEnergy(type));

        addSideEffect(async (game, self) => {
          await game.AttackingPlayer.attachEnergy(self, energy, "energyZone");
        });
      },
    },
    {
      pattern:
        /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to (?:1 of your )?([^.]+)\./i,
      transform: (_, count, type, pokemonSpecifier) => {
        const energyCount = count == "a" ? 1 : Number(count);
        const energy = new Array(energyCount).fill(parseEnergy(type));
        const predicate = parsePokemonPredicate(pokemonSpecifier);

        addSideEffect(async (game) => {
          const validPokemon = game.AttackingPlayer.InPlayPokemon.filter(predicate);
          const pokemon = await game.choosePokemon(game.AttackingPlayer, validPokemon);
          if (pokemon) {
            await game.AttackingPlayer.attachEnergy(pokemon, energy, "energyZone");
          }
        });
      },
    },
    {
      pattern:
        /^Choose 2 of your ([^.]+?)\. For each of those Pokémon, take a \{(\w)\} Energy from your Energy Zone and attach it to that Pokémon\./i,
      transform: (_, pokemonSpecifier, type) => {
        const energy = parseEnergy(type);
        const predicate = parsePokemonPredicate(pokemonSpecifier);

        addSideEffect(async (game) => {
          const pokemon = game.AttackingPlayer.InPlayPokemon.filter(predicate);
          const chosenPokemon = await game.chooseNPokemon(game.AttackingPlayer, pokemon, 2);
          for (const p of chosenPokemon)
            await game.AttackingPlayer.attachEnergy(p, [energy], "energyZone");
        });
      },
    },
    {
      pattern:
        /^Take an amount of \{(\w)\} Energy from your Energy Zone equal to the number of heads and attach it to your ([^.]+?) in any way you like\./i,
      transform: (_, energyType, pokemonSpecifier) => {
        const et = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(pokemonSpecifier);

        addSideEffect(async (game, self, heads) => {
          const validPokemon = game.AttackingPlayer.InPlayPokemon.filter(predicate);
          if (validPokemon.length == 0) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }
          await game.distributeEnergy(
            game.AttackingPlayer,
            new Array(heads).fill(et),
            validPokemon
          );
        });
      },
    },

    // Switching effects
    {
      pattern: /^Switch this Pokémon with 1 of your Benched (.+?)\./i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        addSideEffect(async (game) => {
          const pokemon = await game.choosePokemon(
            game.AttackingPlayer,
            game.AttackingPlayer.BenchedPokemon.filter(predicate)
          );
          if (!pokemon) return;
          await game.AttackingPlayer.swapActivePokemon(pokemon, "selfEffect");
        });
      },
    },
    {
      pattern:
        /^Switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)/i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.chooseNewActivePokemon(game.DefendingPlayer);
        });
      },
    },
    {
      pattern: /^your opponent shuffles their Active Pokémon into their deck\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.DefendingPlayer.shufflePokemonIntoDeck(game.DefendingPlayer.activeOrThrow());
        });
      },
    },
    {
      pattern: /put your opponent’s Active Pokémon into their hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.DefendingPlayer.returnPokemonToHand(game.DefendingPlayer.activeOrThrow());
        });
      },
    },

    // Special Condition effects
    {
      pattern:
        /^Your opponent’s Active Pokémon is now Poisoned\. Do 20 damage to this Pokémon instead of the usual amount for this Special Condition\./i,
      transform: () => {
        addSideEffect(async (game) => game.poisonDefendingPokemon(true));
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Poisoned\./i,
      transform: () => {
        addSideEffect(async (game) => game.poisonDefendingPokemon(false));
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Burned\./i,
      transform: () => {
        addSideEffect(async (game) => game.burnDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Poisoned and Burned\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.poisonDefendingPokemon(false);
          game.burnDefendingPokemon();
        });
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Asleep\./i,
      transform: () => {
        addSideEffect(async (game) => game.sleepDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Paralyzed\./i,
      transform: () => {
        addSideEffect(async (game) => game.paralyzeDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Confused\./i,
      transform: () => {
        addSideEffect(async (game) => game.confuseDefendingPokemon());
      },
    },
    {
      pattern: /^This Pokémon is now Confused\./i,
      transform: () => {
        addSideEffect(async (game, self) => self.player.confuseActivePokemon());
      },
    },
    {
      pattern:
        /^1 Special Condition from among Asleep, Burned, Confused, Paralyzed, and Poisoned is chosen at random, and your opponent’s Active Pokémon is now affected by that Special Condition\. Any Special Conditions already affecting that Pokémon will not be chosen\.$/i,
      transform: () => {
        addSideEffect(async (game) => {
          const conditions = (
            ["Asleep", "Burned", "Confused", "Paralyzed", "Poisoned"] as const
          ).filter(
            (c) =>
              !game.DefendingPlayer.activeOrThrow()
                .CurrentConditions.map((c2) => c2.replace(/\+$/, ""))
                .includes(c)
          );

          const condition = randomElement(conditions);
          if (condition === "Asleep") {
            game.sleepDefendingPokemon();
          } else if (condition === "Burned") {
            game.burnDefendingPokemon();
          } else if (condition === "Confused") {
            game.confuseDefendingPokemon();
          } else if (condition === "Paralyzed") {
            game.paralyzeDefendingPokemon();
          } else if (condition === "Poisoned") {
            game.poisonDefendingPokemon();
          }
        });
      },
    },
    {
      pattern: /^This Pokémon is now Asleep\./i,
      transform: () => {
        addSideEffect(async (game, self) => self.player.sleepActivePokemon());
      },
    },

    // Other status effects
    {
      pattern:
        /^During your opponent’s next turn, this Pokémon takes (−|\+)(\d+) damage from attacks\./i,
      transform: (_, sign, amount) => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "ModifyIncomingAttackDamage",
            amount: Number(amount) * (sign === "+" ? 1 : -1),
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /during your opponent’s next turn, prevent all damage done to this Pokémon by attacks\./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "PreventAttackDamage",
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /^during your opponent’s next turn, prevent all damage from—and effects of—attacks done to this Pokémon\./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "PreventAttackDamageAndEffects",
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, attacks used by the Defending Pokémon do −(\d+) damage\./i,
      transform: (_, damageReduction) => {
        addSideEffect(async (game) =>
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "ReduceOwnAttackDamage",
            amount: Number(damageReduction),
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, if this Pokémon is damaged by an attack, do (\d+) damage to the Attacking Pokémon\./i,
      transform: (_, damage) => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "CounterAttack",
            amount: Number(damage),
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      // Vulpix and Omastar have the same phrase in opposite order, so we account for both arrangements
      pattern:
        /^(?:the Defending Pokémon can’t attack ?|during your opponent’s next turn(?:, )?){2}\./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "CannotAttack",
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern: /^During your opponent’s next turn, the Defending Pokémon can’t retreat\./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "CannotRetreat",
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, if the Defending Pokémon tries to use an attack, your opponent flips a coin. If tails, that attack doesn’t happen./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "CoinFlipToAttack",
            source: "Effect",
            turnsToKeep: 1,
          })
        );
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, attacks used by the Defending Pokémon cost (\d+) {(\w)} more, and its Retreat Cost is (\d+) {C} more./i,
      transform: (_, attackCostModifier, type, retreatCostModifier) => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "ModifyAttackCost",
            amount: Number(attackCostModifier),
            energyType: parseEnergy(type),
            source: "Effect",
            turnsToKeep: 1,
          });
          game.DefendingPlayer.applyActivePokemonStatus({
            type: "ModifyRetreatCost",
            amount: Number(retreatCostModifier),
            source: "Effect",
            turnsToKeep: 1,
          });
        });
      },
    },
    {
      pattern: /^During your next turn, this Pokémon can’t attack\./i,
      transform: () => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "CannotAttack",
            source: "Effect",
            turnsToKeep: 2,
          })
        );
      },
    },
    {
      pattern: /^During your next turn, this Pokémon can’t use (.+?)\./i,
      transform: (_, attackName) => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "CannotUseSpecificAttack",
            attackName,
            source: "Effect",
            turnsToKeep: 2,
          })
        );
      },
    },
    {
      pattern: /^During your next turn, this Pokémon’s (.+?) attack does \+(\d+) damage\./i,
      transform: (_, attackName, increaseAmount) => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "IncreaseDamageOfAttack",
            attackName,
            amount: Number(increaseAmount),
            source: "Effect",
            turnsToKeep: 2,
          })
        );
      },
    },

    // Opponent player effects
    {
      pattern:
        /^Your opponent can’t use any Supporter cards from their hand during their next turn\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.applyPlayerStatus({
            type: "CannotUseSupporter",
            source: "Effect",
            keepNextTurn: true,
          });
        });
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, they can’t play any Item cards from their hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.applyPlayerStatus({
            type: "CannotUseItem",
            source: "Effect",
            keepNextTurn: true,
          });
        });
      },
    },
    {
      pattern:
        /^During your opponent’s next turn, they can’t take any Energy from their Energy Zone to attach to their Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.applyPlayerStatus({
            type: "PokemonStatus",
            source: "Effect",
            keepNextTurn: true,
            pokemonCondition: {
              test: (pokemon) => pokemon === pokemon.player.ActivePokemon,
              descriptor: "Active Pokémon",
            },
            pokemonStatus: {
              type: "CannotAttachFromEnergyZone",
              source: "Effect",
            },
          });
        });
      },
    },

    // Other side effects
    {
      pattern:
        /^Before doing damage, discard all Pokémon Tools from your opponent’s Active Pokémon\./i,
      transform: () => {
        effect.preDamageEffects.push(async (game) => {
          await game.discardPokemonTools(game.DefendingPlayer.activeOrThrow());
        });
      },
    },
    {
      pattern:
        /^Change the type of the next Energy that will be generated for your opponent to 1 of the following at random: ([^.]+?)\./i,
      transform: (_, energyTypes) => {
        const possibleEnergies = energyTypes
          .split(/, or |, /)
          .map((x) => parseEnergy(x.slice(1, 2)));
        addSideEffect(async (game) => {
          game.DefendingPlayer.changeNextEnergy(randomElement(possibleEnergies));
        });
      },
    },

    // Miscellaneous
    {
      pattern:
        /^Choose 1 of your opponent’s( Active)? Pokémon’s attacks and use it as this attack\.( If this Pokémon doesn’t have the necessary Energy to use that attack, this attack does nothing\.)?/i,
      transform: (_, active, energyRequired) => {
        effect.attackingEffects.push(async (game: Game) => {
          const chosenPokemon = active
            ? game.DefendingPlayer.activeOrThrow()
            : await game.choosePokemon(game.AttackingPlayer, game.DefendingPlayer.InPlayPokemon);
          if (!chosenPokemon) {
            game.GameLog.attackFailed(game.AttackingPlayer);
            return;
          }
          const attacks = Object.fromEntries(chosenPokemon.Attacks.map((a) => [a.name, a]));
          const prompt = `Choose an attack to copy from ${chosenPokemon.Name}.`;
          const chosenAttack = await game.choose(game.AttackingPlayer, attacks, prompt);
          if (!chosenAttack) {
            game.GameLog.attackFailed(game.AttackingPlayer);
            return;
          }
          game.GameLog.copyAttack(game.AttackingPlayer, chosenAttack.name);
          let attackFailed =
            chosenAttack.text?.includes("use it as this attack") ||
            chosenAttack.explicitConditions.some((cond) => !cond(game, chosenPokemon));
          if (energyRequired) {
            const active = game.AttackingPlayer.activeOrThrow();
            if (!active.hasSufficientEnergy(chosenAttack.requiredEnergy)) attackFailed = true;
          }
          if (attackFailed) {
            game.GameLog.attackFailed(game.AttackingPlayer);
          } else {
            await game.executeAttack(chosenAttack);
          }
        });
      },
    },
    {
      pattern: /^You can use this attack only if you have Uxie and Azelf on your Bench\./i,
      transform: () => {
        effect.explicitConditions.push((game) =>
          ["Uxie", "Azelf"].every((name) =>
            game.AttackingPlayer.BenchedPokemon.some((p) => p.Name == name)
          )
        );
      },
    },
  ];

  mainloop: while (text) {
    for (const { pattern, transform } of dictionary) {
      const result = text.match(pattern);
      if (result) {
        transform(...result);
        text = text.replace(pattern, "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified attack text
      }
    }

    parseSuccessful = false;
    break;
  }

  if (conditionalForNextEffect) parseSuccessful = false;

  return { parseSuccessful, value: effect };
};
