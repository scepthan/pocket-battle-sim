import { allCards } from "@/assets";
import {
  Game,
  InPlayPokemon,
  parseEnergy,
  Player,
  PlayerStatus,
  PokemonStatus,
  type CoinFlipIndicator,
  type DamageCalculation,
  type Energy,
  type PokemonCard,
  type SideEffect,
} from "../gamelogic";
import type { AbilityTrigger } from "../gamelogic/types/ability/StandardAbility";
import { randomElement, removeElement } from "../util";
import {
  parsePlayingCardPredicate as _cardParse,
  parsePokemonPredicate as _pokemonParse,
  type InPlayPokemonPredicate,
  type PlayingCardPredicate,
} from "./parsePredicates";
import type { ParsedResult } from "./types";

export interface Effect {
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
   * Different attacks use coin flip results in different ways; this indicates how the results
   * should be used. If the attack doesn't do damage, its type will be "NoBaseDamage"; if damage
   * isn't affected by any coin flips, its type will be "PredeterminableDamage".
   */
  attackType:
    | "CoinFlipOrDoNothing"
    | "CoinFlipForDamage"
    | "CoinFlipForAddedDamage"
    | "PredeterminableDamage"
    | "NoBaseDamage";

  /**
   * A method that calculates the base damage of the attack to be applied to the Defending Pokémon.
   * This method should not have any side effects.
   */
  calculateDamage?: DamageCalculation;

  /**
   * A method that determines which Pokémon the player can choose to target for any side effects,
   * such as dealing Bench damage to the opponent or healing an own Pokémon.
   */
  validTargets?: (player: Player, self?: InPlayPokemon) => InPlayPokemon[];

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
  explicitConditions: ((player: Player, self: InPlayPokemon) => boolean)[];

  /**
   * Conditions that must be met for a Trainer or Ability with this effect to be used.
   */
  implicitConditions: ((player: Player, self: InPlayPokemon) => boolean)[];

  /**
   * Trigger for certain abilities and Pokémon Tools.
   */
  trigger?: AbilityTrigger;

  /**
   * Statuses to apply to the player's Active Pokémon.
   */
  selfPokemonStatuses: PokemonStatus[];

  /**
   * Statuses to apply to the opponent's Active Pokémon.
   */
  opponentPokemonStatuses: PokemonStatus[];

  /**
   * Statuses to apply to the player.
   */
  selfPlayerStatuses: PlayerStatus[];

  /**
   * Statuses to apply to the opponent.
   */
  opponentPlayerStatuses: PlayerStatus[];

  /**
   * Leftover conditional for attacks that apply statuses.
   */
  statusConditional?: (game: Game, self: InPlayPokemon, heads: number) => boolean;
}

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => string | void;
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

const findBasicForStage2 = (stage2: PokemonCard) => {
  const stage1Name = stage2.EvolvesFrom;
  if (!stage1Name) return null;
  const stage1 = allCards.find((card) => card.name === stage1Name);
  if (!stage1 || stage1.cardType !== "Pokemon") return null;
  return stage1.previousEvolution ?? null;
};

const selfActive = (player: Player, self: InPlayPokemon) => self.player.ActivePokemon == self;
const selfBenched = (player: Player, self: InPlayPokemon) =>
  self.player.BenchedPokemon.includes(self);

export const statusesToSideEffects = (effect: Effect) => {
  const sideEffects: SideEffect[] = [];

  const applyConditionalIfAvailable = (sideEffect: SideEffect) => {
    if (effect.statusConditional) {
      const conditional = effect.statusConditional;
      sideEffects.push(async (game, self, heads, target) => {
        if (conditional(game, self, heads)) await sideEffect(game, self, heads, target);
      });
    } else sideEffects.push(sideEffect);
  };

  for (const status of effect.selfPokemonStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.applyActivePokemonStatus(Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPokemonStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.opponent.applyActivePokemonStatus(Object.assign({}, status));
    });
  }
  for (const status of effect.selfPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.applyPlayerStatus(Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.opponent.applyPlayerStatus(Object.assign({}, status));
    });
  }

  return sideEffects;
};

export const parseEffect = (
  inputText: string,
  baseDamage?: number,
  requiredEnergy?: Energy[]
): ParsedResult<Effect> => {
  const effect: Effect = {
    attackType: baseDamage === undefined ? "NoBaseDamage" : "PredeterminableDamage",
    preDamageEffects: [],
    attackingEffects: [],
    sideEffects: [],
    explicitConditions: [],
    implicitConditions: [],
    selfPokemonStatuses: [],
    opponentPokemonStatuses: [],
    selfPlayerStatuses: [],
    opponentPlayerStatuses: [],
  };
  let parseSuccessful = true;
  let conditionalForNextEffect:
    | ((game: Game, self: InPlayPokemon, heads: number) => boolean)
    | undefined = undefined;
  baseDamage = baseDamage ?? 0;
  let text = inputText;
  let turnsToKeep: number | undefined;

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

  const cascadeParseFailure = <T>(result: ParsedResult<T>): T => {
    if (!result.parseSuccessful) parseSuccessful = false;
    return result.value;
  };

  const parsePokemonPredicate = (descriptor: string, predicate?: InPlayPokemonPredicate) =>
    cascadeParseFailure(_pokemonParse(descriptor, predicate));
  const parsePlayingCardPredicate = (descriptor: string, predicate?: PlayingCardPredicate) =>
    cascadeParseFailure(_cardParse(descriptor, predicate));
  const parsePokemonPlayerStatus = (
    pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>,
    descriptor: string,
    doesNotStack: boolean = false
  ) => {
    const status = "type" in pokemonStatus ? pokemonStatus : cascadeParseFailure(pokemonStatus);
    return cascadeParseFailure(PlayerStatus.fromPokemonStatus(status, descriptor, doesNotStack));
  };

  const addSelfPokemonStatus = (pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>) => {
    const status = "type" in pokemonStatus ? pokemonStatus : cascadeParseFailure(pokemonStatus);
    effect.selfPokemonStatuses.push(status);
  };
  const addOpponentPokemonStatus = (pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>) => {
    const status = "type" in pokemonStatus ? pokemonStatus : cascadeParseFailure(pokemonStatus);
    effect.opponentPokemonStatuses.push(status);
  };

  const dictionary: EffectTransformer[] = [
    // Triggers
    {
      pattern: /^Once during your turn, you may /i,
      transform: () => {
        effect.trigger = { type: "Manual", multiUse: false };
      },
    },
    {
      pattern: /^As often as you like during your turn, you may /i,
      transform: () => {
        effect.trigger = { type: "Manual", multiUse: true };
      },
    },
    {
      pattern:
        /^If this Pokémon is in the Active Spot and is damaged by an attack from your opponent’s Pokémon, /i,
      transform: () => {
        effect.trigger = { type: "AfterDamagedByAttack" };
        effect.explicitConditions.push(selfActive);
      },
    },
    {
      pattern:
        /^If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent’s Pokémon, /i,
      transform: () => {
        effect.trigger = { type: "AfterKnockedOutByAttack" };
        effect.explicitConditions.push(selfActive);
      },
    },
    {
      pattern: /^If this Pokémon would be Knocked Out by damage from an attack, /i,
      transform: () => {
        effect.trigger = { type: "BeforeKnockedOutByAttack" };
      },
    },
    {
      pattern:
        /^Whenever you attach (?:a {(\w)}|an) Energy from your Energy Zone to (?:this Pokémon|it), /i,
      transform: (_, energyType) => {
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        effect.trigger = { type: "OnEnergyZoneAttach", energy: fullType };
      },
    },
    {
      pattern: /^During Pokémon Checkup, |^At the end of each turn, /i,
      transform: () => {
        effect.trigger = { type: "OnPokemonCheckup" };
      },
    },

    // Pokémon Tool-specific parsing
    {
      pattern: /the ((?:(?! the ).)+?) this card is attached to/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.explicitConditions.push((game, self) => predicate(self));
        return "this Pokémon";
      },
    },
    {
      pattern: /is your Active Pokémon/i,
      transform: () => "is in the Active Spot",
    },

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

    // Set the attack type based on what we're doing with the coin flips
    // CoinFlipOrDoNothing
    {
      pattern: /^If tails, this attack does nothing\./i,
      transform: () => {
        effect.attackType = "CoinFlipOrDoNothing";
      },
    },

    // CoinFlipForDamage
    {
      pattern: /^This attack does (\d+) damage for each heads\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => heads * dmg;
      },
    },

    // CoinFlipForAddedDamage
    {
      pattern: /^This attack does (\d+) more damage for each heads\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + heads * dmg;
      },
    },
    {
      pattern: /^If heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + (heads > 0 ? dmg : 0);
      },
    },
    {
      pattern: /^If both of them are heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, heads) => baseDamage + (heads > 1 ? dmg : 0);
      },
    },

    // Non-damage-determining coin flip conditionals
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

    // Self conditionals
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
      pattern: /^If this Pokémon has damage on it,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.isDamaged();
      },
    },
    {
      pattern: /^If this Pokémon is affected by any Special Conditions,/i,
      transform: () => {
        effect.explicitConditions.push((game, self) => self.hasSpecialCondition());
      },
    },
    {
      pattern: /^If this Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If this Pokémon moved from your Bench to the Active Spot this turn,/i,
      transform: () => {
        conditionalForNextEffect = (game) => {
          // If any switching has happened this turn, then this condition is necessarily met
          const switchingEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "selectActivePokemon" || event.type === "swapActivePokemon"
          );
          return switchingEvents.some((event) => event.player === game.AttackingPlayer.Name);
        };
      },
    },

    // Defending Pokémon conditionals
    {
      pattern: /^If your opponent’s Active Pokémon has damage on it,/i,
      transform: () => {
        conditionalForNextEffect = (game) => game.DefendingPlayer.activeOrThrow().isDamaged();
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

    // Player conditionals
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
          game.setHP(defender, targetHp);
        });
      },
    },
    {
      pattern: /^do (\d+) damage to (?:the Attacking Pokémon|your opponent’s Active Pokémon)\.$/i,
      transform: (_, damage) => {
        addSideEffect(async (game, self) => {
          game.applyDamage(self.player.opponent.activeOrThrow(), Number(damage), false);
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

        effect.validTargets = (player) => player.opponent.InPlayPokemon.filter(predicate);
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
        effect.validTargets = (player) => player.opponent.InPlayPokemon.filter(predicate);
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
    {
      pattern: /^do (\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, damage) => {
        addSideEffect(async (game, self) => {
          game.applyDamage(self.player.opponent.activeOrThrow(), Number(damage), false);
        });
      },
    },
    {
      pattern: /^do (\d+) damage to 1 of your opponent’s Pokémon\.$/i,
      transform: (_, damage) => {
        effect.validTargets = (player) => player.opponent.InPlayPokemon;
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          game.applyDamage(target, Number(damage), false);
        });
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
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },

    // Healing effects
    {
      pattern: /^Heal (\d+) damage from this Pokémon\./i,
      transform: (_, healing) => {
        effect.implicitConditions.push((player, self) => self.isDamaged());
        addSideEffect(async (game, self) => {
          self.healDamage(Number(healing));
        });
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
      pattern: /^Heal (\d+) damage from each of your (.+?)\./i,
      transform: (_, healing, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.implicitConditions.push((player) => player.InPlayPokemon.some(predicate));
        addSideEffect(async (game) => {
          for (const pokemon of game.AttackingPlayer.InPlayPokemon.filter(predicate)) {
            pokemon.healDamage(Number(healing));
          }
        });
      },
    },
    {
      pattern: /^heal (\d+) damage from your Active Pokémon\.$/i,
      transform: (_, modifier) => {
        effect.implicitConditions.push((player) => player.activeOrThrow().isDamaged());
        addSideEffect(async (game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          active.healDamage(Number(modifier));
        });
      },
    },
    {
      pattern:
        /^Heal (\d+) damage and remove a random Special Condition from your Active Pokémon\.$/i,
      transform: (_, modifier) => {
        effect.implicitConditions.push((player) => {
          const active = player.activeOrThrow();
          return active.isDamaged() || active.hasSpecialCondition();
        });
        addSideEffect(async (game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          active.healDamage(Number(modifier));
          active.removeRandomSpecialCondition();
        });
      },
    },
    {
      pattern:
        /^Heal (\d+) damage from 1 of your ([^.]+?), and it recovers from all Special Conditions\.$/i,
      transform: (_, modifier, descriptor) => {
        const predicate = parsePokemonPredicate(
          descriptor,
          (p) => p.isDamaged() || p.hasSpecialCondition()
        );
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          target.healDamage(Number(modifier));
          target.removeAllSpecialConditions();
        });
      },
    },
    {
      pattern: /^it recovers from all of them, and discard this card\.$/i,
      transform: () => {
        addSideEffect(async (game, self) => {
          self.removeAllSpecialConditions();

          const thisCard = self.AttachedToolCards.find((card) => card.Text === inputText);
          if (!thisCard) throw new Error("Could not find this Pokemon Tool card");

          await game.discardPokemonTools(self, [thisCard]);
        });
      },
    },
    {
      pattern: /^Heal (\d+) damage from 1 of your (.+?)\./i,
      transform: (_, healing, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          if (target.isDamaged()) target.healDamage(Number(healing));
        });
      },
    },
    {
      pattern:
        /^Heal all damage from 1 of your ([^.]+?)\. If you do, discard all Energy from that Pokémon\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          target.healDamage(target.MaxHP - target.CurrentHP);
          await game.discardAllEnergy(target);
        });
      },
    },
    {
      pattern: /^move (\d+) of its damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, amount) => {
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const damageHealed = target.healDamage(Number(amount));
          game.applyDamage(game.DefendingPlayer.activeOrThrow(), damageHealed, false);
        });
      },
    },
    {
      pattern:
        /^choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon\.$/i,
      transform: () => {
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const damage = target.currentDamage();
          game.applyDamage(self, damage, false);
          target.healDamage(damage);
        });
      },
    },
    {
      pattern: /^this Pokémon is not Knocked Out, and its remaining HP becomes (\d+)\./i,
      transform: (_, hp) => {
        addSideEffect(async (game, self) => {
          game.setHP(self, Number(hp));
        });
      },
    },

    // Draw effects
    {
      pattern: /^Draw (a|\d+) cards?\./i,
      transform: (_, count) => {
        const cardCount = count == "a" ? 1 : Number(count);
        effect.implicitConditions.push((player) => player.canDraw(true));
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
        effect.implicitConditions.push((player) => player.canDraw());
        addSideEffect(async (game) => {
          game.AttackingPlayer.drawRandomFilteredToHand(predicate);
        });
      },
    },
    {
      pattern: /^Put 1 random (.+?) from your deck onto your bench\./i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push(
          (player) => player.canDraw(true) && player.Bench.some((p) => !p.isPokemon)
        );
        addSideEffect(async (game) => {
          await game.AttackingPlayer.playRandomFilteredToBench(predicate);
        });
      },
    },
    {
      pattern:
        /^Look at the top card of your deck\. If that card is a (.+?), put it into your hand\. If it is not a \1, put it on the bottom of your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);

        effect.implicitConditions.push((player) => player.canDraw(true));
        addSideEffect(async (game) => {
          const topCard = game.AttackingPlayer.Deck.shift()!;
          await game.showCards(game.AttackingPlayer, [topCard]);

          if (predicate(topCard)) {
            game.AttackingPlayer.Hand.push(topCard);
            game.GameLog.putIntoHand(game.AttackingPlayer, [topCard]);
          } else {
            game.AttackingPlayer.Deck.push(topCard);
            game.GameLog.returnToBottomOfDeck(game.AttackingPlayer, [topCard]);
          }
        });
      },
    },
    {
      pattern: /^Choose a (.+?) in your hand and switch it with a random \1 in your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Hand.some(predicate));
        addSideEffect(async (game) => {
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
        });
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your discard pile into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Discard.some(predicate));
        addSideEffect(async (game) => {
          const validCards = game.AttackingPlayer.Discard.filter(predicate);
          const card = randomElement(validCards);
          removeElement(game.AttackingPlayer.Discard, card);
          game.AttackingPlayer.Hand.push(card);
          game.GameLog.putIntoHand(game.AttackingPlayer, [card]);
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

    // Opponent hand manipulation
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/i,
      transform: (_, count) => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(Number(count));
        });
      },
    },
    {
      pattern:
        /^Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win\.$/i,
      transform: () => {
        addSideEffect(async (game) => {
          const cardsToDraw = game.GameRules.PrizePoints - game.DefendingPlayer.GamePoints;
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(cardsToDraw);
        });
      },
    },
    {
      pattern:
        /^Each player shuffles the cards in their hand into their deck, then draws that many cards\.$/i,
      transform: () => {
        addSideEffect(async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(game.DefendingPlayer.Hand.length);
          game.AttackingPlayer.shuffleHandIntoDeckAndDraw(game.AttackingPlayer.Hand.length);
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
      pattern: /^Your opponent reveals their hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.showCards(game.AttackingPlayer, game.DefendingPlayer.Hand);
        });
      },
    },

    // Deck manipulation effects
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/i,
      transform: (_, count) => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game) => {
          await game.showCards(
            game.AttackingPlayer,
            game.AttackingPlayer.Deck.slice(0, Number(count))
          );
        });
      },
    },
    {
      pattern: /^Look at the top card of your deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game) => {
          await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
        });
      },
    },
    {
      pattern: /^Then, you may shuffle your deck\./i,
      transform: () => {
        addSideEffect(async (game) => {
          const choice = await game.chooseYesNo(game.AttackingPlayer, "Shuffle deck?");
          if (choice) game.AttackingPlayer.shuffleDeck();
        });
      },
    },
    {
      pattern: /^choose either player\. Look at the top card of that player’s deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game, self) => {
          const options = { Self: self.player, Opponent: self.player.opponent };
          const chosenPlayer = await game.choose(self.player, options, "Choose a player.");
          if (!chosenPlayer) throw new Error("No player chosen");

          if (chosenPlayer.Deck.length > 0) {
            await game.showCards(self.player, chosenPlayer.Deck.slice(0, 1));
          }
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
      pattern: /^For each heads, discard a random Energy from your opponent’s Active Pokémon\.$/i,
      transform: () => {
        addSideEffect(async (game, self, heads) => {
          const active = game.DefendingPlayer.activeOrThrow();
          await game.DefendingPlayer.discardRandomEnergyFromPokemon(active, heads);
        });
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
        /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to this Pokémon\.( If you use this Ability, your turn ends\.)?/i,
      transform: (_, count, type, endTurn) => {
        const energyCount = count == "a" ? 1 : Number(count);
        const energy = new Array(energyCount).fill(parseEnergy(type));

        addSideEffect(async (game, self) => {
          await game.AttackingPlayer.attachEnergy(self, energy, "energyZone");
          if (endTurn) game.endTurnResolve(true);
        });
      },
    },
    {
      pattern:
        /^Take (a|\d+) \{(\w)\} Energy from your Energy Zone and attach it to (?:1 of your )?([^.]+)\.( Your turn ends\.)?/i,
      transform: (_, count, type, descriptor, endTurn) => {
        const energyCount = count == "a" ? 1 : Number(count);
        const energy = new Array(energyCount).fill(parseEnergy(type));
        if (descriptor !== "that Pokémon") {
          const predicate = parsePokemonPredicate(descriptor);
          effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        }

        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await game.AttackingPlayer.attachEnergy(target, energy, "energyZone");
          if (endTurn) game.endTurnResolve(true);
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
    {
      pattern:
        /^For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/i,
      transform: (_, energyType) => {
        const et = parseEnergy(energyType);

        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await game.AttackingPlayer.attachEnergy(target, new Array(heads).fill(et), "energyZone");
        });
      },
    },
    {
      pattern: /^Attach (\d+) \{(\w)\} Energy from your discard pile to that Pokémon\.$/i,
      transform: (_, count, energyType) => {
        const fullType = parseEnergy(energyType);

        effect.implicitConditions.push((player) => player.DiscardedEnergy.includes(fullType));
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const energyToAttach: Energy[] = [];
          for (let i = 0; i < Number(count); i++) {
            if (!game.AttackingPlayer.DiscardedEnergy.includes(fullType)) break;
            energyToAttach.push(fullType);
            removeElement(game.AttackingPlayer.DiscardedEnergy, fullType);
          }
          await game.AttackingPlayer.attachEnergy(target, energyToAttach, "discard");
        });
      },
    },

    // Energy transfer effects
    {
      pattern:
        /^Move all {(\w)} Energy from your Benched Pokémon to your (.+?) in the Active Spot\.$/i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

        effect.implicitConditions.push((player) => predicate(player.activeOrThrow()));
        addSideEffect(async (game) => {
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
        });
      },
    },
    {
      pattern:
        /^move (an?|all)(?: {(\w)})? Energy from 1 of your (Benched .+?) to your Active (.+?)\./i,
      transform: (_, amount, energyType, benchedSpecifier, activeSpecifier) => {
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        const benchPredicate = parsePokemonPredicate(benchedSpecifier, (p) =>
          fullType ? p.AttachedEnergy.includes(fullType) : p.AttachedEnergy.length > 0
        );
        const activePredicate = parsePokemonPredicate(activeSpecifier);

        effect.implicitConditions.push((player) => activePredicate(player.activeOrThrow()));
        effect.validTargets = (player) => player.BenchedPokemon.filter(benchPredicate);

        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const active = self.player.activeOrThrow();

          const prompt = "Choose an Energy to move.";
          const energyToMove =
            amount === "all"
              ? target.AttachedEnergy.filter((e) => !fullType || e === fullType)
              : fullType
              ? [fullType]
              : await game.chooseNEnergy(self.player, target.AttachedEnergy, 1, prompt);

          await self.player.transferEnergy(target, active, energyToMove);
        });
      },
    },
    {
      pattern: /^move all {(\w)} Energy from this Pokémon to 1 of your (.+?)\./i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);
        effect.implicitConditions.push((player, self) => self.AttachedEnergy.includes(fullType));
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const energyToMove = self.AttachedEnergy.filter((e) => e === fullType);
          await self.player.transferEnergy(self, target, energyToMove);
        });
      },
    },

    // Pokemon Tool effects
    {
      pattern: /^Discard all Pokémon Tool cards attached to each of your opponent’s Pokémon\./i,
      transform: () => {
        effect.implicitConditions.push((player) =>
          player.opponent.InPlayPokemon.some((p) => p.AttachedToolCards.length > 0)
        );
        addSideEffect(async (game) => {
          for (const pokemon of game.DefendingPlayer.InPlayPokemon) {
            await game.discardPokemonTools(pokemon);
          }
        });
      },
    },

    // Switching effects
    {
      pattern: /^Switch this Pokémon with 1 of your Benched (.+?)\./i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.BenchedPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await game.AttackingPlayer.swapActivePokemon(target, "selfEffect");
        });
      },
    },
    {
      pattern: /^switch it with your Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await game.AttackingPlayer.swapActivePokemon(self, "selfEffect");
        });
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.implicitConditions.push((player) => predicate(player.activeOrThrow()));
        addSideEffect(async (game) => {
          await game.AttackingPlayer.returnPokemonToHand(game.AttackingPlayer.activeOrThrow());
        });
      },
    },
    {
      pattern: /^Put 1 of your (.+?) into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await game.AttackingPlayer.returnPokemonToHand(target);
        });
      },
    },
    {
      pattern:
        /^Switch out your opponent’s Active (.+?) to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.implicitConditions.push(
          (player) =>
            predicate(player.opponent.activeOrThrow()) && player.opponent.BenchedPokemon.length > 0
        );
        addSideEffect(async (game) => {
          await game.chooseNewActivePokemon(game.DefendingPlayer);
        });
      },
    },
    {
      pattern: /^Switch in 1 of your opponent’s (.+?) to the Active Spot\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.opponent.BenchedPokemon.filter(predicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await game.DefendingPlayer.swapActivePokemon(
            target,
            "opponentEffect",
            game.AttackingPlayer.Name
          );
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
      pattern: /^put your opponent’s Active Pokémon into their hand\./i,
      transform: () => {
        addSideEffect(async (game) => {
          await game.DefendingPlayer.returnPokemonToHand(game.DefendingPlayer.activeOrThrow());
        });
      },
    },

    // Pokemon playing effects
    {
      pattern: /^Put a Basic Pokémon from your opponent’s discard pile onto their Bench\.$/i,
      transform: () => {
        effect.implicitConditions.push(
          (player) =>
            player.opponent.Bench.some((slot) => !slot.isPokemon) &&
            player.opponent.Discard.some((card) => card.CardType == "Pokemon" && card.Stage == 0)
        );
        addSideEffect(async (game) => {
          const benchIndex = game.DefendingPlayer.Bench.findIndex((slot) => !slot.isPokemon);
          if (benchIndex < 0) return;
          const validCards = game.DefendingPlayer.Discard.filter(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          );
          const card = await game.chooseCard(game.AttackingPlayer, validCards);
          if (!card) return;
          await game.DefendingPlayer.putPokemonOnBench(card as PokemonCard, benchIndex, card);
        });
      },
    },
    {
      pattern:
        /^Choose 1 of your Basic Pokémon in play\. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1\. You can’t use this card during your first turn or on a Basic Pokémon that was put into play this turn\.$/i,
      transform: () => {
        effect.validTargets = (player) => {
          const validBasicNames = player.Hand.filter(
            (card) => card.CardType === "Pokemon" && card.Stage == 2
          )
            .map((card) => findBasicForStage2(card as PokemonCard))
            .filter((name) => name !== null);

          return player.InPlayPokemon.filter(
            (p) => p.Stage == 0 && p.ReadyToEvolve && validBasicNames.includes(p.Name)
          );
        };
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;

          const validCards = game.AttackingPlayer.Hand.filter(
            (card) =>
              card.CardType === "Pokemon" &&
              card.Stage == 2 &&
              findBasicForStage2(card as PokemonCard) === target.Name
          );
          const card = await game.chooseCard(game.AttackingPlayer, validCards);
          if (!card) return;

          await game.AttackingPlayer.evolvePokemon(target, card as PokemonCard, true);
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
      pattern: /^(?:make )?your opponent’s Active Pokémon (?:is now )?Poisoned\./i,
      transform: () => {
        addSideEffect(async (game) => game.poisonDefendingPokemon(false));
      },
    },
    {
      pattern: /^the Attacking Pokémon is now Poisoned\./i,
      transform: () => {
        addSideEffect(async (game) => game.AttackingPlayer.poisonActivePokemon());
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
      pattern: /^(?:This Pokémon|it) is now Asleep\./i,
      transform: () => {
        addSideEffect(async (game, self) => self.player.sleepActivePokemon());
      },
    },

    // Status effect headers
    {
      pattern: /^During this turn, /i,
      transform: () => {
        turnsToKeep = 0;
      },
    },
    {
      pattern: / ?During (your opponent’s|their) next turn(?:, )?/i,
      transform: () => {
        turnsToKeep = 1;
      },
    },
    {
      pattern: /^During your next turn, /i,
      transform: () => {
        turnsToKeep = 2;
      },
    },

    // Self Pokémon status effects
    {
      pattern:
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus(PokemonStatus.ModifyAttackDamage(Number(amount)));
      },
    },
    {
      pattern: /^this Pokémon takes (−|\+)(\d+) damage from attacks(?: from ([^.]+?))?\./i,
      transform: (_, sign, amount, descriptor) => {
        const trueAmount = Number(amount) * (sign === "+" ? 1 : -1);
        addSelfPokemonStatus(
          PokemonStatus.ModifyIncomingAttackDamage(trueAmount, turnsToKeep, descriptor)
        );
      },
    },
    {
      pattern:
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, this Pokémon takes −(\d+) damage from that attack\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus(PokemonStatus.ModifyIncomingAttackDamageOnCoinFlip(-Number(amount)));
      },
    },
    {
      pattern:
        /^prevent all damage done to this Pokémon by attacks(?: from your opponent’s (.+?))?\./i,
      transform: (_, descriptor) => {
        addSelfPokemonStatus(PokemonStatus.PreventAttackDamage(turnsToKeep, descriptor));
      },
    },
    {
      pattern:
        /^prevent all effects of attacks used by your opponent’s Pokémon done to this Pokémon\./i,
      transform: () => {
        addSelfPokemonStatus(PokemonStatus.PreventAttackEffects(turnsToKeep));
      },
    },
    {
      pattern: /^prevent all damage from—and effects of—attacks done to this Pokémon\./i,
      transform: () => {
        addSelfPokemonStatus(PokemonStatus.PreventAttackDamageAndEffects(turnsToKeep));
      },
    },
    {
      pattern:
        /^if this Pokémon is damaged by an attack, do (\d+) damage to the Attacking Pokémon\./i,
      transform: (_, damage) => {
        addSelfPokemonStatus(PokemonStatus.CounterAttack(Number(damage), turnsToKeep));
      },
    },
    {
      pattern: /^This Pokémon can’t be affected by any Special Conditions\./i,
      transform: () => {
        addSelfPokemonStatus({
          type: "PreventSpecialConditions",
          source: "Effect",
        });
      },
    },
    {
      pattern: /^this Pokémon can’t attack\./i,
      transform: () => {
        addSelfPokemonStatus({
          type: "CannotAttack",
          source: "Effect",
          turnsToKeep,
        });
      },
    },
    {
      pattern: /^this Pokémon can’t use (.+?)\./i,
      transform: (_, attackName) => {
        addSelfPokemonStatus({
          type: "CannotUseSpecificAttack",
          attackName,
          source: "Effect",
          turnsToKeep,
        });
      },
    },
    {
      pattern: /^this Pokémon’s (.+?) attack does \+(\d+) damage\./i,
      transform: (_, attackName, increaseAmount) => {
        addSelfPokemonStatus(
          PokemonStatus.ModifyDamageOfAttack(attackName, Number(increaseAmount), turnsToKeep)
        );
      },
    },
    {
      pattern: /^attacks used by this Pokémon cost (\d+) less {(\w)} Energy\./i,
      transform: (_, amount, energyType) => {
        const fullType = parseEnergy(energyType);

        addSelfPokemonStatus({
          type: "ModifyAttackCost",
          energyType: fullType,
          amount: -Number(amount),
          source: "Effect",
        });
      },
    },
    {
      pattern: /^(it|this Pokémon) has no Retreat Cost\.$/i,
      transform: () => {
        addSelfPokemonStatus({
          type: "NoRetreatCost",
          source: "Effect",
        });
      },
    },
    {
      pattern: /^this Pokémon gets \+(\d+) HP\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus({
          type: "IncreaseMaxHP",
          amount: Number(amount),
          source: "Effect",
        });
      },
    },

    // Defending Pokémon status effects
    {
      pattern: /^attacks used by the Defending Pokémon do −(\d+) damage\./i,
      transform: (_, damageReduction) => {
        addOpponentPokemonStatus(
          PokemonStatus.ModifyAttackDamage(-Number(damageReduction), turnsToKeep)
        );
      },
    },
    {
      pattern: /^the Defending Pokémon can’t attack\./i,
      transform: () => {
        addOpponentPokemonStatus({
          type: "CannotAttack",
          source: "Effect",
          turnsToKeep,
        });
      },
    },
    {
      pattern: /^the Defending Pokémon can’t retreat\./i,
      transform: () => {
        addOpponentPokemonStatus({
          type: "CannotRetreat",
          source: "Effect",
          turnsToKeep,
        });
      },
    },
    {
      pattern:
        /^if the Defending Pokémon tries to use an attack, your opponent flips a coin\. If tails, that attack doesn’t happen\./i,
      transform: () => {
        addOpponentPokemonStatus({
          type: "CoinFlipToAttack",
          source: "Effect",
          turnsToKeep,
        });
      },
    },
    {
      pattern:
        /^attacks used by the Defending Pokémon cost (\d+) {(\w)} more, and its Retreat Cost is (\d+) {C} more\./i,
      transform: (_, attackCostModifier, type, retreatCostModifier) => {
        addOpponentPokemonStatus({
          type: "ModifyAttackCost",
          amount: Number(attackCostModifier),
          energyType: parseEnergy(type),
          source: "Effect",
          turnsToKeep,
        });
        addOpponentPokemonStatus({
          type: "ModifyRetreatCost",
          amount: Number(retreatCostModifier),
          source: "Effect",
          turnsToKeep,
        });
      },
    },

    // Self player effects
    {
      pattern: /^the Retreat Cost of your (.+?) is (\d+) less\.$/i,
      transform: (_, descriptor, modifier) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            {
              type: "ModifyRetreatCost",
              amount: -Number(modifier),
              source: "PlayerStatus",
            },
            descriptor
          )
        );
      },
    },
    {
      pattern: /^attacks used by your (.+?) do \+(\d+) damage to your opponent’s (.+?)\.$/i,
      transform: (_, selfSpecifier, modifier, opponentSpecifier) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyAttackDamage(Number(modifier), turnsToKeep, opponentSpecifier),
            selfSpecifier
          )
        );
      },
    },
    {
      pattern: /^attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/i,
      transform: (_, descriptor, count, energy) => {
        const fullType = parseEnergy(energy);

        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            {
              type: "ModifyAttackCost",
              energyType: fullType,
              amount: -Number(count),
              source: "PlayerStatus",
            },
            descriptor
          )
        );
      },
    },
    {
      pattern:
        /^all of your (.+?) take −(\d+) damage from attacks from your opponent’s Pokémon\.$/i,
      transform: (_, descriptor, modifier) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyIncomingAttackDamage(-Number(modifier)),
            descriptor
          )
        );
      },
    },
    {
      pattern: /^your (Active .+?)’s Retreat Cost is (\d+) less\./i,
      transform: (_, descriptor, amount) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            {
              type: "ModifyRetreatCost",
              amount: -Number(amount),
              source: "PlayerStatus",
            },
            descriptor
          )
        );
      },
    },
    {
      pattern: /^your (Active .+?) has no Retreat Cost\./i,
      transform: (_, descriptor) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus({ type: "NoRetreatCost", source: "PlayerStatus" }, descriptor)
        );
      },
    },
    {
      pattern:
        /^Each of your (.+?) recovers from all Special Conditions and can’t be affected by any Special Conditions\.$/i,
      transform: (_, descriptor) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            { type: "PreventSpecialConditions", source: "PlayerStatus" },
            descriptor
          )
        );
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your (.+?) provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);

        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            {
              type: "DoubleEnergy",
              energyType: fullType,
              source: "PlayerStatus",
            },
            descriptor,
            true
          )
        );
      },
    },

    // Opponent player effects
    {
      pattern: /^attacks used by your opponent’s (.+?) do −(\d+) damage\./i,
      transform: (_, descriptor, damageReduction) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyAttackDamage(-Number(damageReduction), turnsToKeep),
            descriptor
          )
        );
      },
    },
    {
      pattern: /^Your opponent can’t use any Supporter cards from their hand\./i,
      transform: () => {
        effect.opponentPlayerStatuses.push(PlayerStatus.CannotUseSupporter());
      },
    },
    {
      pattern: /^they can’t play any Item cards from their hand\./i,
      transform: () => {
        effect.opponentPlayerStatuses.push(PlayerStatus.CannotUseItem());
      },
    },
    {
      pattern: /^Your opponent can’t play any Pokémon from their hand to evolve their (.+?)\.$/i,
      transform: (_, descriptor) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus({ type: "CannotEvolve", source: "PlayerStatus" }, descriptor)
        );
      },
    },
    {
      pattern: /^they can’t take any Energy from their Energy Zone to attach to their (.+?)\./i,
      transform: (_, descriptor) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(
            {
              type: "CannotAttachFromEnergyZone",
              source: "PlayerStatus",
            },
            descriptor
          )
        );
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
        effect.attackingEffects.push(async (game) => {
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
            chosenAttack.explicitConditions.some(
              (cond) => !cond(game.AttackingPlayer, chosenPokemon)
            );
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

    // Targeting
    {
      pattern: /^Choose 1 of your (?!opponent)(.+?)(?:, and|\.)/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
      },
    },

    // Explicit conditions
    {
      pattern: /^You can use this attack only if you have Uxie and Azelf on your Bench\./i,
      transform: () => {
        effect.explicitConditions.push((player) =>
          ["Uxie", "Azelf"].every((name) => player.BenchedPokemon.some((p) => p.Name == name))
        );
      },
    },
    {
      pattern: /(?:You can use this card only)? ?if you have (.+?) in play[.,]/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        effect.explicitConditions.push((player) => player.InPlayPokemon.some(predicate));
      },
    },
    {
      pattern: /^You must discard a card from your hand in order to use this Ability\./i,
      transform: () => {
        effect.explicitConditions.push((player) => player.Hand.length > 0);
        addSideEffect(async (game, self) => {
          const player = self.player;
          const cardToDiscard = await game.chooseCard(player, player.Hand);
          if (!cardToDiscard) throw new Error("No card chosen to discard");
          player.discardCardsFromHand([cardToDiscard]);
        });
      },
    },
    {
      pattern: /(If|^As long as) this Pokémon is in the Active Spot, /i,
      transform: () => {
        effect.explicitConditions.push(selfActive);
      },
    },
    {
      pattern: /(If|^As long as) this Pokémon is on your Bench, /i,
      transform: () => {
        effect.explicitConditions.push(selfBenched);
      },
    },
    {
      pattern: /^If this Pokémon has any Energy attached, /i,
      transform: () => {
        effect.explicitConditions.push((player, self) => self.AttachedEnergy.length > 0);
      },
    },
    {
      pattern: /^During your first turn, /i,
      transform: () => {
        effect.explicitConditions.push((player) => {
          const turnNumber = player.game.TurnNumber;
          return player === player.game.AttackingPlayer && 1 <= turnNumber && turnNumber <= 2;
        });
      },
    },
  ];

  mainloop: while (text) {
    for (const { pattern, transform } of dictionary) {
      const result = text.match(pattern);
      if (result) {
        const replace = transform(...result);
        text = text.replace(pattern, replace ?? "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified attack text
      }
    }

    parseSuccessful = false;
    break;
  }

  if (conditionalForNextEffect) {
    if (statusesToSideEffects(effect).length === 0) {
      console.warn("Unused conditional:", effect);
      parseSuccessful = false;
    } else {
      effect.statusConditional = conditionalForNextEffect;
    }
  }

  // For debugging effect text that should theoretically be parsing but isn't
  //if (text) console.warn(`Unparsed effect text: "${text}"`);

  return { parseSuccessful, value: effect };
};
