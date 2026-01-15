import { allCards } from "@/assets";
import {
  Game,
  InPlayPokemon,
  parseEnergy,
  Player,
  PlayerStatus,
  PokemonStatus,
  type Energy,
  type PokemonCard,
  type SideEffect,
} from "../gamelogic";
import { randomElement, removeElement } from "../util";
import {
  parsePlayingCardPredicate as _cardParse,
  parsePokemonPredicate as _pokemonParse,
  type InPlayPokemonPredicate,
  type PlayingCardPredicate,
} from "./parsePredicates";
import type { ParsedEffect, ParsedResult } from "./types";

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
const isOwnFirstTurn = (player: Player) => {
  const turnNumber = player.game.TurnNumber;
  return player === player.game.AttackingPlayer && 1 <= turnNumber && turnNumber <= 2;
};

export const statusesToSideEffects = (effect: ParsedEffect) => {
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
      game.applyPokemonStatus(self, Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPokemonStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      game.applyPokemonStatus(self.opponent.activeOrThrow(), Object.assign({}, status));
    });
  }
  for (const status of effect.selfPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.applyPlayerStatus(Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.opponent.applyPlayerStatus(Object.assign({}, status));
    });
  }

  return sideEffects;
};

export const parseEffect = (
  inputText: string,
  baseDamage?: number,
  requiredEnergy?: Energy[]
): ParsedResult<ParsedEffect> => {
  const effect: ParsedEffect = {
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
    doesNotStack?: boolean
  ) => {
    const status = "type" in pokemonStatus ? pokemonStatus : cascadeParseFailure(pokemonStatus);
    const keepNextTurn = turnsToKeep !== undefined && turnsToKeep > 0;
    return cascadeParseFailure(
      PlayerStatus.fromPokemonStatus(status, descriptor, keepNextTurn, doesNotStack)
    );
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
    {
      pattern: /^At the end of your first turn, /i,
      transform: () => {
        effect.trigger = { type: "OnPokemonCheckup" };
        effect.explicitConditions.push(isOwnFirstTurn);
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
        effect.coinsToFlip = (game, self) => self.player.InPlayPokemon.length;
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
      pattern: /^If both of them are heads,/i,
      transform: () => {
        conditionalForNextEffect = (game, self, heads) => heads >= 2;
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
        conditionalForNextEffect = (game, self) => {
          // If any switching has happened this turn, then this condition is necessarily met
          const switchingEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "selectActivePokemon" || event.type === "swapActivePokemon"
          );
          return switchingEvents.some((event) => event.player === self.player.Name);
        };
      },
    },

    // Defending Pokémon conditionals
    {
      pattern: /^If your opponent’s Active Pokémon has damage on it,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.opponent.activeOrThrow().isDamaged();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has more remaining HP than this Pokémon,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) =>
          self.opponent.activeOrThrow().CurrentHP > self.CurrentHP;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is Poisoned,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => self.opponent.activeOrThrow().isPoisoned();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is affected by a Special Condition,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) =>
          self.opponent.activeOrThrow().hasSpecialCondition();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is a ([^,]+?),/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        conditionalForNextEffect = (game, self) => predicate(self.opponent.activeOrThrow());
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has an Ability,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) =>
          self.opponent.activeOrThrow().Ability !== undefined;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) =>
          self.opponent.activeOrThrow().AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If your opponent’s Pokémon is knocked out by damage from this attack,/i,
      transform: () => {
        conditionalForNextEffect = (game, self) => {
          const damageEvents = game.GameLog.currentTurn.filter(
            (event) => event.type === "pokemonDamaged"
          );
          const activeAttackEvent = damageEvents.find(
            (event) =>
              event.player === self.opponent.Name &&
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
        conditionalForNextEffect = (game, self) => self.player.InPlayPokemon.some(predicate);
      },
    },
    {
      pattern: /^If (.+?) is on your Bench,/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        conditionalForNextEffect = (game, self) => self.player.BenchedPokemon.some(predicate);
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
        effect.calculateDamage = (game, self) => {
          const energyCount = self.opponent.activeOrThrow().EffectiveEnergy.length;
          return (more ? baseDamage : 0) + energyCount * Number(damagePerEnergy);
        };
      },
    },
    {
      pattern:
        /^This attack does (\d+)( more)? damage for each of your opponent’s Benched Pokémon\./i,
      transform: (_, damagePerBench, more) => {
        effect.calculateDamage = (game, self) => {
          const benchedCount = self.opponent.BenchedPokemon.length;
          return (more ? baseDamage : 0) + benchedCount * Number(damagePerBench);
        };
      },
    },
    {
      pattern: /^This attack does (\d+)( more)? damage for each of your ([^.]+)\./i,
      transform: (_, damageEach, more, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.calculateDamage = (game, self) => {
          const pokemonCount = self.player.InPlayPokemon.filter(predicate).length;
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
        effect.attackingEffects.push(async (game, self) => {
          const pokemon = randomElement(self.opponent.InPlayPokemon);
          game.attackPokemon(pokemon, Number(damage));
        });
      },
    },
    {
      pattern:
        /^1 of your opponent’s Pokémon is chosen at random (\d+) times\. For each time a Pokémon was chosen, do (\d+) damage to it\./i,
      transform: (_, times, damage) => {
        effect.attackingEffects.push(async (game, self) => {
          const damages = self.opponent.InPlayPokemon.map((p) => ({
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
        effect.attackingEffects.push(async (game, self) => {
          const defender = self.opponent.activeOrThrow();
          const targetHp = Math.floor(defender.CurrentHP / 2 / 10) * 10;
          game.setHP(defender, targetHp);
        });
      },
    },
    {
      pattern: /^your opponent’s Active Pokémon is Knocked Out\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await game.knockOutPokemon(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern: /^do (\d+) damage to (?:the Attacking Pokémon|your opponent’s Active Pokémon)\.$/i,
      transform: (_, damage) => {
        addSideEffect(async (game, self) => {
          game.applyDamage(self.opponent.activeOrThrow(), Number(damage), false);
        });
      },
    },

    // Damage to opponent’s bench
    {
      pattern: /^This attack also does (\d+) damage to each of your opponent’s (Benched [^.]+?)\./i,
      transform: (_, benchDamage, descriptor) => {
        const dmg = Number(benchDamage);
        const predicate = parsePokemonPredicate(descriptor);
        const benchDamageEffect = applyConditionalIfAvailable(async (game, self) => {
          for (const p of self.opponent.BenchedPokemon) {
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
        const attackEffect = applyConditionalIfAvailable(async (game, self) => {
          for (const pokemon of self.opponent.InPlayPokemon) {
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
          game.applyDamage(self.opponent.activeOrThrow(), Number(damage), false);
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
              event.player === self.opponent.Name &&
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
        addSideEffect(async (game, self) => {
          for (const pokemon of self.player.InPlayPokemon.filter(predicate)) {
            pokemon.healDamage(Number(healing));
          }
        });
      },
    },
    {
      pattern: /^heal (\d+) damage from your Active Pokémon\.$/i,
      transform: (_, modifier) => {
        effect.implicitConditions.push((player) => player.activeOrThrow().isDamaged());
        addSideEffect(async (game, self) => {
          const active = self.player.activeOrThrow();
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
        addSideEffect(async (game, self) => {
          const active = self.player.activeOrThrow();
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
          game.applyDamage(self.opponent.activeOrThrow(), damageHealed, false);
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
        addSideEffect(async (game, self) => self.player.drawCards(cardCount));
      },
    },
    {
      pattern:
        /^Shuffle your hand into your deck\. Draw a card for each card in your opponent’s hand\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          self.player.shuffleHandIntoDeck();
          self.player.drawCards(self.opponent.Hand.length);
        });
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\./i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.canDraw());
        addSideEffect(async (game, self) => {
          self.player.drawRandomFilteredToHand(predicate);
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
        addSideEffect(async (game, self) => {
          await self.player.playRandomFilteredToBench(predicate);
        });
      },
    },
    {
      pattern:
        /^Look at the top card of your deck\. If that card is a (.+?), put it into your hand\. If it is not a \1, put it on the bottom of your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);

        effect.implicitConditions.push((player) => player.canDraw(true));
        addSideEffect(async (game, self) => {
          const topCard = self.player.Deck.shift()!;
          await game.showCards(self.player, [topCard]);

          if (predicate(topCard)) {
            self.player.Hand.push(topCard);
            game.GameLog.putIntoHand(self.player, [topCard]);
          } else {
            self.player.Deck.push(topCard);
            game.GameLog.returnToBottomOfDeck(self.player, [topCard]);
          }
        });
      },
    },
    {
      pattern: /^Choose a (.+?) in your hand and switch it with a random \1 in your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Hand.some(predicate));
        addSideEffect(async (game, self) => {
          const validHandCards = self.player.Hand.filter(predicate);
          const chosen = await game.chooseCard(self.player, validHandCards);
          if (!chosen) return;

          const validDeckCards = self.player.Deck.filter(predicate);
          if (validDeckCards.length == 0) {
            game.GameLog.noValidCards(self.player);
            return;
          }
          const pokemonFromDeck = randomElement(validDeckCards);

          removeElement(self.player.Hand, chosen);
          self.player.Deck.push(chosen);
          game.GameLog.returnToDeck(self.player, [chosen], "hand");

          removeElement(self.player.Deck, pokemonFromDeck);
          self.player.Hand.push(pokemonFromDeck);
          game.GameLog.putIntoHand(self.player, [pokemonFromDeck]);

          self.player.shuffleDeck();
        });
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your discard pile into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Discard.some(predicate));
        addSideEffect(async (game, self) => {
          const validCards = self.player.Discard.filter(predicate);
          const card = randomElement(validCards);
          removeElement(self.player.Discard, card);
          self.player.Hand.push(card);
          game.GameLog.putIntoHand(self.player, [card]);
        });
      },
    },
    {
      pattern: /^Discard the top (\d+) cards of your deck\./i,
      transform: (_, count) => {
        addSideEffect(async (game, self) => {
          self.player.discardTopOfDeck(Number(count));
        });
      },
    },

    // Opponent hand manipulation
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/i,
      transform: (_, count) => {
        addSideEffect(async (game, self) => {
          self.opponent.shuffleHandIntoDeckAndDraw(Number(count));
        });
      },
    },
    {
      pattern:
        /^Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win\.$/i,
      transform: () => {
        addSideEffect(async (game, self) => {
          const cardsToDraw = game.GameRules.PrizePoints - self.opponent.GamePoints;
          self.opponent.shuffleHandIntoDeckAndDraw(cardsToDraw);
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
        addSideEffect(async (game, self) => {
          self.opponent.discardRandomFiltered(predicate);
        });
      },
    },
    {
      pattern:
        /^Your opponent reveals their hand\. Choose a card you find there and shuffle it into your opponent’s deck\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          const card = await game.chooseCard(self.player, self.opponent.Hand);
          if (!card) return;
          self.opponent.returnToDeck([card]);
        });
      },
    },
    {
      pattern:
        /^your opponent reveals a random card from their hand and shuffles it into their deck\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          if (self.opponent.Hand.length === 0) return;
          const card = randomElement(self.opponent.Hand);
          await game.showCards(self.player, [card]);
          self.opponent.returnToDeck([card]);
        });
      },
    },
    {
      pattern:
        /^For each heads, a card is chosen at random from your opponent’s hand\. Your opponent reveals that card and shuffles it into their deck\./i,
      transform: () => {
        addSideEffect(async (game, self, heads) => {
          if (self.opponent.Hand.length === 0 || heads === 0) return;
          const cards = [];
          while (heads-- > 0 && self.opponent.Hand.length > 0) {
            cards.push(randomElement(self.opponent.Hand));
          }
          await game.showCards(self.player, cards);
          self.opponent.returnToDeck(cards);
        });
      },
    },
    {
      pattern: /^Your opponent reveals their hand\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.opponent.Hand);
        });
      },
    },
    {
      pattern: /^Discard the top (\d+) cards of each player’s deck\./i,
      transform: (_, count) => {
        addSideEffect(async (game, self) => {
          self.player.discardTopOfDeck(+count);
          self.opponent.discardTopOfDeck(+count);
        });
      },
    },

    // Deck manipulation effects
    {
      pattern: /^Look at the top (\d+) cards of your deck\.$/i,
      transform: (_, count) => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.player.Deck.slice(0, Number(count)));
        });
      },
    },
    {
      pattern: /^Look at the top card of your deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.player.Deck.slice(0, 1));
        });
      },
    },
    {
      pattern: /^Then, you may shuffle your deck\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          const choice = await game.chooseYesNo(self.player, "Shuffle deck?");
          if (choice) self.player.shuffleDeck();
        });
      },
    },
    {
      pattern: /^choose either player\. Look at the top card of that player’s deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        addSideEffect(async (game, self) => {
          const options = { Self: self.player, Opponent: self.opponent };
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
          async (game, self) => await game.discardRandomEnergy(self.opponent.activeOrThrow())
        );
      },
    },
    {
      pattern: /^For each heads, discard a random Energy from your opponent’s Active Pokémon\.$/i,
      transform: () => {
        addSideEffect(async (game, self, heads) => {
          const active = self.opponent.activeOrThrow();
          await self.opponent.discardRandomEnergyFromPokemon(active, heads);
        });
      },
    },
    {
      pattern: /^Discard a random Energy from both Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await game.discardRandomEnergy(game.AttackingPlayer.activeOrThrow());
          await game.discardRandomEnergy(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern:
        /^Discard a random Energy from among the Energy attached to all Pokémon \(both yours and your opponent’s\)\./i,
      transform: () => {
        addSideEffect(async (game) => {
          const allEnergy: { pokemon: InPlayPokemon; energy: Energy }[] = [];
          for (const p of game.InPlayPokemon) {
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
          await self.player.attachEnergy(self, energy, "energyZone");
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
          await self.player.attachEnergy(target, energy, "energyZone");
          if (endTurn) game.endTurnResolve(true);
        });
      },
    },
    {
      pattern:
        /^Choose 2 of your ([^.]+?)\. For each of those Pokémon, take a \{(\w)\} Energy from your Energy Zone and attach it to that Pokémon\./i,
      transform: (_, descriptor, type) => {
        const energy = parseEnergy(type);
        const predicate = parsePokemonPredicate(descriptor);

        addSideEffect(async (game, self) => {
          const pokemon = self.player.InPlayPokemon.filter(predicate);
          const chosenPokemon = await game.chooseNPokemon(self.player, pokemon, 2);
          for (const p of chosenPokemon) await self.player.attachEnergy(p, [energy], "energyZone");
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
          const validPokemon = self.player.InPlayPokemon.filter(predicate);
          if (validPokemon.length == 0) {
            game.GameLog.noValidTargets(self.player);
            return;
          }
          await game.distributeEnergy(self.player, new Array(heads).fill(et), validPokemon);
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
          await self.player.attachEnergy(target, new Array(heads).fill(et), "energyZone");
        });
      },
    },
    {
      pattern:
        /^Attach (\d+) (?:\{(\w)\}|random) Energy from your discard pile to that Pokémon\.$/i,
      transform: (_, count, energyType) => {
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        const energyFilter = (e: Energy) => fullType === undefined || e === fullType;

        effect.implicitConditions.push((player) => player.DiscardedEnergy.some(energyFilter));
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          const energyToAttach: Energy[] = [];
          for (let i = 0; i < Number(count); i++) {
            if (!self.player.DiscardedEnergy.some(energyFilter)) break;
            const e = fullType ?? randomElement(self.player.DiscardedEnergy);
            energyToAttach.push(e);
            removeElement(self.player.DiscardedEnergy, e);
          }
          await self.player.attachEnergy(target, energyToAttach, "discard");
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
        addSideEffect(async (game, self) => {
          for (const pokemon of self.player.BenchedPokemon) {
            const energyToMove = pokemon.AttachedEnergy.filter((e) => e == fullType);
            if (energyToMove.length > 0) {
              await self.player.transferEnergy(pokemon, self.player.activeOrThrow(), energyToMove);
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
    {
      pattern:
        /^move 2 \{(\w)\} Energy from that Pokémon and attach 1 Energy each to 2 of your ([^.]+?)\./i,
      transform: (_, type, descriptor) => {
        const energy = parseEnergy(type);
        const predicate = parsePokemonPredicate(descriptor);
        effect.implicitConditions.push(
          (player, pokemon) =>
            pokemon.AttachedEnergy.filter((e) => e === energy).length > 0 &&
            player.InPlayPokemon.filter(predicate).length > 0
        );

        addSideEffect(async (game, self) => {
          const energyCount = Math.min(2, self.AttachedEnergy.filter((e) => e === energy).length);
          const pokemon = self.player.InPlayPokemon.filter(predicate);
          const chosenPokemon = await game.chooseNPokemon(self.player, pokemon, energyCount);
          for (const p of chosenPokemon) await self.player.transferEnergy(self, p, [energy]);
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
        addSideEffect(async (game, self) => {
          for (const pokemon of self.opponent.InPlayPokemon) {
            await game.discardPokemonTools(pokemon);
          }
        });
      },
    },

    // Switching effects
    {
      pattern: /^Switch (?:this Pokémon|your Active (.+?)) with 1 of your Benched (.+?)\./i,
      transform: (_, activeDescriptor, benchDescriptor) => {
        if (activeDescriptor) {
          const activePredicate = parsePokemonPredicate(activeDescriptor);
          effect.implicitConditions.push((player) => activePredicate(player.activeOrThrow()));
        }

        const benchPredicate = parsePokemonPredicate(benchDescriptor);
        effect.validTargets = (player) => player.BenchedPokemon.filter(benchPredicate);
        addSideEffect(async (game, self, heads, target) => {
          if (!target) return;
          await self.player.swapActivePokemon(target, "selfEffect");
        });
      },
    },
    {
      pattern: /^switch it with your Active Pokémon\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await self.player.swapActivePokemon(self, "selfEffect");
        });
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        effect.implicitConditions.push((player) => predicate(player.activeOrThrow()));
        addSideEffect(async (game, self) => {
          await self.player.returnPokemonToHand(self.player.activeOrThrow());
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
          await self.player.returnPokemonToHand(target);
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
        addSideEffect(async (game, self) => {
          await game.chooseNewActivePokemon(self.opponent);
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
          await self.opponent.swapActivePokemon(target, "opponentEffect", self.player.Name);
        });
      },
    },
    {
      pattern: /^your opponent shuffles their Active Pokémon into their deck\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await self.opponent.shufflePokemonIntoDeck(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern: /^put your opponent’s Active Pokémon into their hand\./i,
      transform: () => {
        addSideEffect(async (game, self) => {
          await self.opponent.returnPokemonToHand(self.opponent.activeOrThrow());
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
        addSideEffect(async (game, self) => {
          const benchIndex = self.opponent.Bench.findIndex((slot) => !slot.isPokemon);
          if (benchIndex < 0) return;
          const validCards = self.opponent.Discard.filter(
            (card) => card.CardType == "Pokemon" && card.Stage == 0
          );
          const card = await game.chooseCard(self.player, validCards);
          if (!card) return;
          await self.opponent.putPokemonOnBench(card as PokemonCard, benchIndex, card);
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

          const validCards = self.player.Hand.filter(
            (card) =>
              card.CardType === "Pokemon" &&
              card.Stage == 2 &&
              findBasicForStage2(card as PokemonCard) === target.Name
          );
          const card = await game.chooseCard(self.player, validCards);
          if (!card) return;

          await self.player.evolvePokemon(target, card as PokemonCard, true);
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
        addSideEffect(async (game, self) => {
          const conditions = (
            ["Asleep", "Burned", "Confused", "Paralyzed", "Poisoned"] as const
          ).filter(
            (c) =>
              !self.opponent
                .activeOrThrow()
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
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon for each point you have gotten\.$/i,
      transform: (_, amount) => {
        effect.implicitConditions.push((player) => player.GamePoints >= 1);
        addSelfPokemonStatus(
          PokemonStatus.ModifyAttackDamage({
            descriptor: "+10 damage for each point you have gotten",
            calc: (self) => +amount * self.player.GamePoints,
          })
        );
      },
    },
    {
      pattern:
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus(PokemonStatus.ModifyAttackDamage(+amount));
      },
    },
    {
      pattern: /^this Pokémon takes (−|\+)(\d+) damage from attacks(?: from ([^.]+?))?\./i,
      transform: (_, sign, amount, descriptor) => {
        const trueAmount = +amount * (sign === "+" ? 1 : -1);
        addSelfPokemonStatus(
          PokemonStatus.ModifyIncomingAttackDamage(trueAmount, turnsToKeep, descriptor)
        );
      },
    },
    {
      pattern:
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, this Pokémon takes −(\d+) damage from that attack\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus(PokemonStatus.ModifyIncomingAttackDamageOnCoinFlip(-amount));
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
        addSelfPokemonStatus(PokemonStatus.CounterAttack(+damage, turnsToKeep));
      },
    },
    {
      pattern: /^This Pokémon can’t be affected by any Special Conditions\./i,
      transform: () => {
        addSelfPokemonStatus(PokemonStatus.PreventSpecialConditions(turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon can’t attack\./i,
      transform: () => {
        addSelfPokemonStatus(PokemonStatus.CannotAttack(turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon can’t use (.+?)\./i,
      transform: (_, attackName) => {
        addSelfPokemonStatus(PokemonStatus.CannotUseSpecificAttack(attackName, turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon’s (.+?) attack does \+(\d+) damage\./i,
      transform: (_, attackName, increaseAmount) => {
        addSelfPokemonStatus(
          PokemonStatus.ModifyDamageOfAttack(attackName, +increaseAmount, turnsToKeep)
        );
      },
    },
    {
      pattern: /^attacks used by this Pokémon cost (\d+) less {(\w)} Energy\./i,
      transform: (_, amount, energyType) => {
        const fullType = parseEnergy(energyType);
        addSelfPokemonStatus(PokemonStatus.ModifyAttackCost(fullType, -amount, turnsToKeep));
      },
    },
    {
      pattern: /^(it|this Pokémon) has no Retreat Cost\.$/i,
      transform: () => {
        addSelfPokemonStatus(PokemonStatus.NoRetreatCost(turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon gets \+(\d+) HP\.$/i,
      transform: (_, amount) => {
        addSelfPokemonStatus(PokemonStatus.IncreaseMaxHP(+amount, turnsToKeep));
      },
    },

    // Defending Pokémon status effects
    {
      pattern: /^attacks used by the Defending Pokémon do −(\d+) damage\./i,
      transform: (_, damageReduction) => {
        addOpponentPokemonStatus(PokemonStatus.ModifyAttackDamage(-damageReduction, turnsToKeep));
      },
    },
    {
      pattern: /^the Defending Pokémon can’t attack\./i,
      transform: () => {
        addOpponentPokemonStatus(PokemonStatus.CannotAttack(turnsToKeep));
      },
    },
    {
      pattern: /^the Defending Pokémon can’t retreat\./i,
      transform: () => {
        addOpponentPokemonStatus(PokemonStatus.CannotRetreat(turnsToKeep));
      },
    },
    {
      pattern:
        /^if the Defending Pokémon tries to use an attack, your opponent flips a coin\. If tails, that attack doesn’t happen\./i,
      transform: () => {
        addOpponentPokemonStatus(PokemonStatus.CoinFlipToAttack(turnsToKeep));
      },
    },
    {
      pattern:
        /^attacks used by the Defending Pokémon cost (\d+) {(\w)} more, and its Retreat Cost is (\d+) {C} more\./i,
      transform: (_, attackCostModifier, type, retreatCostModifier) => {
        addOpponentPokemonStatus(
          PokemonStatus.ModifyAttackCost(parseEnergy(type), +attackCostModifier, turnsToKeep)
        );
        addOpponentPokemonStatus(
          PokemonStatus.ModifyRetreatCost(+retreatCostModifier, turnsToKeep)
        );
      },
    },

    // Self player effects
    {
      pattern: /^the Retreat Cost of your (.+?) is (\d+) less\.$/i,
      transform: (_, descriptor, modifier) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyRetreatCost(-modifier, turnsToKeep),
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
            PokemonStatus.ModifyAttackDamage(+modifier, turnsToKeep, opponentSpecifier),
            selfSpecifier
          )
        );
      },
    },
    {
      pattern: /^attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/i,
      transform: (_, descriptor, count, energy) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyAttackCost(parseEnergy(energy), -count, turnsToKeep),
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
          parsePokemonPlayerStatus(PokemonStatus.ModifyIncomingAttackDamage(-modifier), descriptor)
        );
      },
    },
    {
      pattern: /^your (Active .+?)’s Retreat Cost is (\d+) less\./i,
      transform: (_, descriptor, amount) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.ModifyRetreatCost(-amount), descriptor)
        );
      },
    },
    {
      pattern: /^your (Active .+?) has no Retreat Cost\./i,
      transform: (_, descriptor) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.NoRetreatCost(), descriptor)
        );
      },
    },
    {
      pattern:
        /^Each of your (.+?) recovers from all Special Conditions and can’t be affected by any Special Conditions\.$/i,
      transform: (_, descriptor) => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.PreventSpecialConditions(), descriptor)
        );
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your (.+?) provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);

        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.DoubleEnergy(fullType), descriptor, true)
        );
      },
    },

    // Both player effects
    {
      pattern: /^Pokémon \(both yours and your opponent’s\) can’t be healed\.$/i,
      transform: () => {
        effect.selfPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.CannotHeal(turnsToKeep), "Pokémon")
        );
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.CannotHeal(turnsToKeep), "Pokémon")
        );
      },
    },

    // Opponent player effects
    {
      pattern: /^attacks used by your opponent’s (.+?) do −(\d+) damage\./i,
      transform: (_, descriptor, damageReduction) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(
            PokemonStatus.ModifyAttackDamage(-damageReduction, turnsToKeep),
            descriptor
          )
        );
      },
    },
    {
      pattern: /^Your opponent can’t use any Supporter cards from their hand\./i,
      transform: () => {
        effect.opponentPlayerStatuses.push(
          PlayerStatus.CannotUseSupporter(turnsToKeep !== undefined && turnsToKeep > 0)
        );
      },
    },
    {
      pattern: /^they can’t play any Item cards from their hand\./i,
      transform: () => {
        effect.opponentPlayerStatuses.push(
          PlayerStatus.CannotUseItem(turnsToKeep !== undefined && turnsToKeep > 0)
        );
      },
    },
    {
      pattern: /^Your opponent can’t play any Pokémon from their hand to evolve their (.+?)\.$/i,
      transform: (_, descriptor) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.CannotEvolve(), descriptor)
        );
      },
    },
    {
      pattern: /^they can’t take any Energy from their Energy Zone to attach to their (.+?)\./i,
      transform: (_, descriptor) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.CannotAttachFromEnergyZone(), descriptor)
        );
      },
    },
    {
      pattern: /^Your opponent’s (.+?) takes \+(\d+) damage from being Poisoned\./i,
      transform: (_, descriptor, amount) => {
        effect.opponentPlayerStatuses.push(
          parsePokemonPlayerStatus(PokemonStatus.IncreasePoisonDamage(+amount), descriptor)
        );
      },
    },

    // Other side effects
    {
      pattern:
        /^Before doing damage, discard all Pokémon Tools from your opponent’s Active Pokémon\./i,
      transform: () => {
        effect.preDamageEffects.push(async (game, self) => {
          await game.discardPokemonTools(self.opponent.activeOrThrow());
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
        addSideEffect(async (game, self) => {
          self.opponent.changeNextEnergy(randomElement(possibleEnergies));
        });
      },
    },

    // Miscellaneous
    {
      pattern:
        /^Choose 1 of your opponent’s( Active)? Pokémon’s attacks and use it as this attack\.( If this Pokémon doesn’t have the necessary Energy to use that attack, this attack does nothing\.)?/i,
      transform: (_, active, energyRequired) => {
        effect.attackingEffects.push(async (game, self) => {
          const chosenPokemon = active
            ? self.opponent.activeOrThrow()
            : await game.choosePokemon(self.player, self.opponent.InPlayPokemon);
          if (!chosenPokemon) {
            game.GameLog.attackFailed(self.player);
            return;
          }
          const attacks = Object.fromEntries(chosenPokemon.Attacks.map((a) => [a.name, a]));
          const prompt = `Choose an attack to copy from ${chosenPokemon.Name}.`;
          const chosenAttack = await game.choose(self.player, attacks, prompt);
          if (!chosenAttack) {
            game.GameLog.attackFailed(self.player);
            return;
          }
          game.GameLog.copyAttack(self.player, chosenAttack.name);
          let attackFailed =
            chosenAttack.text?.includes("use it as this attack") ||
            chosenAttack.explicitConditions.some((cond) => !cond(self.player, chosenPokemon));
          if (energyRequired) {
            const active = self.player.activeOrThrow();
            if (!active.hasSufficientEnergy(chosenAttack.requiredEnergy)) attackFailed = true;
          }
          if (attackFailed) {
            game.GameLog.attackFailed(self.player);
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
      pattern: /^You can use this card only if your opponent hasn’t gotten any points\./i,
      transform: () => {
        effect.explicitConditions.push((player) => player.opponent.GamePoints === 0);
      },
    },
    {
      pattern: /^You can use this card only if your opponent has gotten at least 1 point\./i,
      transform: () => {
        effect.explicitConditions.push((player) => player.opponent.GamePoints >= 1);
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
        effect.explicitConditions.push(isOwnFirstTurn);
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
