import {
  InPlayPokemonCard,
  parseEnergy,
  type Attack,
  type Energy,
  type Game,
  type SideEffect,
} from "../gamelogic";
import { randomElement } from "../util";
import {
  parsePlayingCardPredicate as _cardParse,
  parsePokemonPredicate as _pokemonParse,
} from "./parsePredicates";

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

export const parseAttackEffect = (attack: Attack): boolean => {
  let parseSuccessful = true;
  let conditionalForNextEffect:
    | ((game: Game, self: InPlayPokemonCard, heads: number) => boolean)
    | undefined = undefined;

  /**
   * Takes an effect and returns a new one that only runs if the previously parsed condition is met.
   *
   * As an example: "Flip a coin. If heads, discard a random card from your opponent's hand."
   *
   * The "If heads," is parsed and stored as conditionalForNextEffect. The parser for "discard a
   * random card" can then call this method to only apply if the coin flip results in heads.
   */
  const applyConditionalIfAvailable: (effect: SideEffect) => SideEffect = (effect: SideEffect) => {
    if (conditionalForNextEffect) {
      const prevConditional = conditionalForNextEffect;
      conditionalForNextEffect = undefined;
      return async (game, self, heads, target) => {
        if (prevConditional(game, self, heads)) await effect(game, self, heads, target);
      };
    }
    return effect;
  };

  const addSideEffect = (effect: SideEffect) => {
    attack.sideEffects.push(applyConditionalIfAvailable(effect));
  };

  const parsePokemonPredicate = (specifier: string) => {
    const { parseSuccessful: success, value } = _pokemonParse(specifier);
    if (!success) parseSuccessful = false;
    return value;
  };
  const parsePlayingCardPredicate = (specifier: string) => {
    const { parseSuccessful: success, value } = _cardParse(specifier);
    if (!success) parseSuccessful = false;
    return value;
  };

  const dictionary: EffectTransformer[] = [
    // Coin flipping
    {
      pattern: /^Flip (a|\d+) coins?\./i,
      transform: (_, count) => {
        attack.coinsToFlip = count === "a" ? 1 : Number(count);
      },
    },
    {
      pattern: /^Flip a coin until you get tails\./i,
      transform: () => {
        attack.coinsToFlip = "UntilTails";
      },
    },
    {
      pattern: /^Flip a coin for each(?: \{(\w)\})? Energy attached to this Pokémon\./i,
      transform: (_, type) => {
        const fullType = type ? parseEnergy(type) : undefined;
        const predicate = fullType ? (e: Energy) => e == fullType : () => true;
        attack.coinsToFlip = (game, self) => self.EffectiveEnergy.filter(predicate).length;
      },
    },
    {
      pattern: /^Flip a coin for each Pokémon you have in play\./i,
      transform: () => {
        attack.coinsToFlip = (game) => game.AttackingPlayer.InPlayPokemon.length;
      },
    },

    // Set the type based on what we're doing with the coin flips
    // CoinFlipOrDoNothing
    {
      pattern: /^If tails, this attack does nothing\./i,
      transform: () => {
        attack.type = "CoinFlipOrDoNothing";
      },
    },

    // CoinFlipForDamage
    {
      pattern: /^This attack does (\d+) damage for each heads\./i,
      transform: (_, damage) => {
        attack.type = "CoinFlipForDamage";
        const dmg = Number(damage);
        attack.calculateDamage = (game, self, heads) => heads * dmg;
      },
    },

    // CoinFlipForAddedDamage
    {
      pattern: /^This attack does (\d+) more damage for each heads\./i,
      transform: (_, damage) => {
        attack.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        attack.calculateDamage = (game, self, heads) => (attack.baseDamage ?? 0) + heads * dmg;
      },
    },
    {
      pattern: /^If heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        attack.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        attack.calculateDamage = (game, self, heads) =>
          (attack.baseDamage ?? 0) + (heads > 0 ? dmg : 0);
      },
    },
    {
      pattern: /^If both of them are heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        attack.type = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        attack.calculateDamage = (game, self, heads) =>
          (attack.baseDamage ?? 0) + (heads > 1 ? dmg : 0);
      },
    },

    {
      pattern: /^If this Pokémon has at least (\d+) extra (?:\{(\w)\} )?Energy attached,/i,
      transform: (_, energyCount, energyType) => {
        const e = parseEnergy(energyType || "C");
        const secondaryRequiredEnergy = attack.requiredEnergy.slice();
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
      pattern: /^If your opponent’s Active Pokémon is Poisoned,/i,
      transform: () => {
        conditionalForNextEffect = (game) => game.DefendingPlayer.activeOrThrow().isPoisoned();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is affected by a Special Condition,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.DefendingPlayer.activeOrThrow().CurrentConditions.length > 0;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is a ([^,]+?),/i,
      transform: (_, specifier) => {
        const predicate = parsePokemonPredicate(specifier);
        conditionalForNextEffect = (game) => predicate(game.DefendingPlayer.activeOrThrow());
      },
    },
    {
      pattern:
        /^If any of your Pokémon were knocked out by damage from an attack during your opponent’s last turn,/i,
      transform: () => {
        conditionalForNextEffect = (game) =>
          game.GameLog.turns[1]?.some((e) => e.type == "pokemonKnockedOut" && e.fromAttack) ??
          false;
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
      pattern: /^If heads,/i,
      transform: () => {
        conditionalForNextEffect = (game, self, heads) => heads > 0;
      },
    },
    {
      pattern: /^If at least (\d+) of them are heads,/i,
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
        attack.calculateDamage = (game, self) =>
          (attack.baseDamage ?? 0) + (prevConditional(game, self, 0) ? Number(extraDamage) : 0);
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each Energy attached to your opponent’s Active Pokémon\./i,
      transform: (_, damagePerEnergy, more) => {
        attack.calculateDamage = (game) => {
          const energyCount = game.DefendingPlayer.activeOrThrow().EffectiveEnergy.length;
          return (more ? attack.baseDamage ?? 0 : 0) + energyCount * Number(damagePerEnergy);
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each of your opponent’s Benched Pokémon\./i,
      transform: (_, damagePerBench, more) => {
        attack.calculateDamage = (game) => {
          const benchedCount = game.DefendingPlayer.BenchedPokemon.length;
          return (more ? attack.baseDamage ?? 0 : 0) + benchedCount * Number(damagePerBench);
        };
      },
    },
    {
      pattern: /^This attack does (\d+)( more)? damage for each of your ([^.]+)\./i,
      transform: (_, damageEach, more, specifier) => {
        const predicate = parsePokemonPredicate(specifier);

        attack.calculateDamage = (game) => {
          const pokemonCount = game.AttackingPlayer.InPlayPokemon.filter(predicate).length;
          return (more ? attack.baseDamage ?? 0 : 0) + pokemonCount * Number(damageEach);
        };
      },
    },
    {
      pattern: /^This attack does more damage equal to the damage this Pokémon has on it\./i,
      transform: () => {
        attack.calculateDamage = (game, self) => (attack.baseDamage ?? 0) + self.currentDamage();
      },
    },
    {
      pattern: /^1 of your opponent’s Pokémon is chosen at random\. Do (\d+) damage to it\./i,
      transform: (_, damage) => {
        attack.attackingEffects.push(async (game) => {
          const pokemon = randomElement(game.DefendingPlayer.InPlayPokemon);
          game.attackPokemon(pokemon, Number(damage));
        });
      },
    },
    {
      pattern:
        /^1 of your opponent’s Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\./i,
      transform: (_, times, damage) => {
        attack.attackingEffects.push(async (game) => {
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
        attack.attackingEffects.push(async (game) => {
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
      transform: (_, benchDamage, specifier) => {
        const dmg = Number(benchDamage);
        const predicate = parsePokemonPredicate(specifier);
        const benchDamageEffect = applyConditionalIfAvailable(async (game) => {
          for (const p of game.DefendingPlayer.BenchedPokemon) {
            if (predicate(p)) game.attackPokemon(p, dmg);
          }
        });
        attack.attackingEffects.push(benchDamageEffect);
      },
    },
    {
      pattern: /^This attack(?: also)? does (\d+) damage to 1 of your opponent’s (.+?)\./i,
      transform: (_, damage, specifier) => {
        const predicate = parsePokemonPredicate(specifier);
        attack.choosePokemonToAttack = (game) =>
          game.DefendingPlayer.InPlayPokemon.filter(predicate);
        attack.attackingEffects.push(attackTargetIfExists(Number(damage)));
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
        attack.attackingEffects.push(attackEffect);
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
        attack.attackingEffects.push(selfAttackEffect);
      },
    },
    {
      pattern: /^This attack also does (\d+) damage to 1 of your Benched Pokémon\./i,
      transform: (_, damage) => {
        attack.choosePokemonToAttack = (game) => game.AttackingPlayer.BenchedPokemon;
        attack.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },

    // Healing effects
    {
      pattern: /^Heal (\d+) damage from this Pokémon\./,
      transform: (_, healing) => {
        addSideEffect(async (game, self) => game.healPokemon(self, Number(healing)));
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
          game.healPokemon(self, activeAttackEvent.damageDealt);
        });
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your Pokémon\./,
      transform: (_, HP) => {
        addSideEffect(async (game) => {
          for (const pokemon of game.AttackingPlayer.InPlayPokemon) {
            if (pokemon.isDamaged()) game.healPokemon(pokemon, Number(HP));
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
      pattern: /^Put 1 random (.+?) from your deck into your hand\./i,
      transform: (_, specifier) => {
        const predicate = parsePlayingCardPredicate(specifier);
        addSideEffect(async (game) => {
          game.AttackingPlayer.drawRandomFilteredToHand(predicate);
        });
      },
    },
    {
      pattern: /^Put 1 random (.+?) from your deck onto your bench\./i,
      transform: (_, specifier) => {
        const predicate = parsePlayingCardPredicate(specifier);
        addSideEffect(async (game) => {
          await game.AttackingPlayer.playRandomFilteredToBench(predicate);
        });
      },
    },
    {
      pattern: /^discard a random card from your opponent’s hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.discardRandomFiltered();
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
        addSideEffect(async (game) =>
          game.discardRandomEnergy(game.DefendingPlayer.activeOrThrow())
        );
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
          const allEnergy: { pokemon: InPlayPokemonCard; energy: Energy }[] = [];
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
      pattern: /^Switch this Pokémon with 1 of your Benched Pokémon\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.swapActivePokemon(game.AttackingPlayer, "selfEffect");
        });
      },
    },
    {
      pattern:
        /^Switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)/i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
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
      pattern: /^This Pokémon is now Asleep\./i,
      transform: () => {
        addSideEffect(async (game, self) => self.player.sleepActivePokemon());
      },
    },

    // Other status effects
    {
      pattern:
        /^During your opponent’s next turn, this Pokémon takes −(\d+) damage from attacks\./i,
      transform: (_, damageReduction) => {
        addSideEffect(async (game) =>
          game.AttackingPlayer.applyActivePokemonStatus({
            type: "ReduceAttackDamage",
            amount: Number(damageReduction),
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
            category: "GameRule",
            keepNextTurn: true,
          });
        });
      },
    },

    // Other side effects
    {
      pattern:
        /^Before doing damage, discard all Pokémon Tools from your opponent’s Active Pokémon\./i,
      transform: () => {
        attack.preDamageEffects.push(async (game) => {
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
        attack.attackingEffects.push(async (game: Game) => {
          const chosenPokemon = active
            ? game.DefendingPlayer.activeOrThrow()
            : await game.choosePokemon(game.AttackingPlayer, game.DefendingPlayer.InPlayPokemon);
          if (!chosenPokemon) {
            game.GameLog.attackFailed(game.AttackingPlayer);
            return;
          }
          const attacks = Object.fromEntries(chosenPokemon.Attacks.map((a) => [a.name, a]));
          const chosenAttack = await game.choose(game.AttackingPlayer, attacks);
          if (!chosenAttack) {
            game.GameLog.attackFailed(game.AttackingPlayer);
            return;
          }
          game.GameLog.copyAttack(game.AttackingPlayer, chosenAttack.name);
          let attackFailed =
            chosenAttack.text?.includes("use it as this attack") ||
            chosenAttack.extraConditions.some((cond) => !cond(game, chosenPokemon));
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
        attack.extraConditions.push((game) =>
          ["Uxie", "Azelf"].every((name) =>
            game.AttackingPlayer.BenchedPokemon.some((p) => p.Name == name)
          )
        );
      },
    },
  ];

  let attackText = attack.text;
  mainloop: while (attackText) {
    for (const { pattern, transform } of dictionary) {
      const result = attackText.match(pattern);
      if (result) {
        transform(...result);
        attackText = attackText.replace(pattern, "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified attack text
      }
    }

    parseSuccessful = false;
    break;
  }

  if (conditionalForNextEffect) parseSuccessful = false;

  return parseSuccessful;
};
