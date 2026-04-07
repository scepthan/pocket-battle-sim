import {
  InPlayPokemon,
  parseEnergy,
  Player,
  PlayerStatus,
  PokemonStatus,
  type Energy,
  type PokemonCard,
  type SideEffect,
} from "../gamelogic";
import * as Effects from "../gamelogic/effects";
import { randomElement, randomElements, removeElement } from "../util";
import { EffectParser, statusesToSideEffects } from "./EffectParser";
import { parseEnergies } from "./parseEnergies";
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
  (damage: number) => async (game, self, amount, target) => {
    if (!target) return;
    game.attackPokemon(target, damage);
  };

const selfActive = (player: Player, self: InPlayPokemon) => self.player.ActivePokemon == self;
const selfBenched = (player: Player, self: InPlayPokemon) =>
  self.player.BenchedPokemon.includes(self);
const isOwnFirstTurn = (player: Player) => {
  const turnNumber = player.game.TurnNumber;
  return player === player.game.AttackingPlayer && 1 <= turnNumber && turnNumber <= 2;
};

export const parseEffect = (
  inputText: string,
  baseDamage?: number,
  requiredEnergy?: Energy[],
): ParsedResult<ParsedEffect> => {
  const parser = new EffectParser(baseDamage !== undefined);
  const { effect } = parser;
  baseDamage = baseDamage ?? 0;
  let text = inputText;

  const dictionary: EffectTransformer[] = [
    {
      pattern: /^Choose 1: {2,}(.+?\.) {2,}(.+?\.)$/i,
      transform: (_, text1, text2) => {
        const effect1 = parser.cascadeParseFailure(parseEffect(text1, baseDamage, requiredEnergy));
        const sideEffects1 = effect1.sideEffects.concat(statusesToSideEffects(effect1));

        const effect2 = parser.cascadeParseFailure(parseEffect(text2, baseDamage, requiredEnergy));
        const sideEffects2 = effect2.sideEffects.concat(statusesToSideEffects(effect2));

        const choices = { "Effect 1": sideEffects1, "Effect 2": sideEffects2 };
        const prompt = "Which effect will you use?";
        parser.addSideEffect(async (game, self, amount, target) => {
          const chosenEffect = await game.choose(self.player, choices, prompt);
          if (!chosenEffect) return;
          for (const sideEffect of chosenEffect) await sideEffect(game, self, amount, target);
        });
      },
    },

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
        /^If this Pokémon is Knocked Out by damage from an attack from your opponent’s Pokémon, /i,
      transform: () => {
        effect.trigger = { type: "AfterKnockedOutByAttack" };
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
        /^Once during your turn, when you play this Pokémon from your hand to evolve 1 of your Pokémon, you may /i,
      transform: () => {
        effect.trigger = { type: "OnEvolution", optional: true };
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
      pattern: /^At the end of your turn, /i,
      transform: () => {
        effect.trigger = { type: "OnPokemonCheckup" };
        effect.explicitConditions.push((player) => player === player.game.AttackingPlayer);
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
        const predicate = parser.parsePokemonPredicate(descriptor);
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
        effect.flipCoins = true;
        effect.passedAmount = count === "a" ? 1 : Number(count);
      },
    },
    {
      pattern: /^Flip a coin until you get tails\./i,
      transform: () => {
        effect.flipCoins = true;
        effect.passedAmount = "UntilTails";
      },
    },
    {
      pattern: /^Flip a coin for each <amount>\./i,
      transform: () => {
        effect.flipCoins = true;
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
        effect.calculateDamage = (game, self, amount) => amount * dmg;
      },
    },

    // CoinFlipForAddedDamage
    {
      pattern: /^This attack does (\d+) more damage for each heads\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, amount) => baseDamage + amount * dmg;
      },
    },
    {
      pattern: /^If heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, amount) => baseDamage + (amount > 0 ? dmg : 0);
      },
    },
    {
      pattern: /^If both of them are heads, this attack does (\d+) more damage\./i,
      transform: (_, damage) => {
        effect.attackType = "CoinFlipForAddedDamage";
        const dmg = Number(damage);
        effect.calculateDamage = (game, self, amount) => baseDamage + (amount > 1 ? dmg : 0);
      },
    },

    // Non-damage-determining coin flip conditionals
    {
      pattern: /^If heads,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self, amount) => amount > 0;
      },
    },
    {
      pattern: /^If both of them are heads,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self, amount) => amount >= 2;
      },
    },
    {
      pattern: /^If at least (\d+) of them (?:is|are) heads,/i,
      transform: (_, headsNeeded) => {
        parser.conditionalForNextEffect = (player, self, amount) => amount >= Number(headsNeeded);
      },
    },
    {
      pattern: /^If tails,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self, amount) => amount === 0;
      },
    },

    // Player conditionals
    {
      pattern: /^If you played a Supporter card from your hand during this turn,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player) => player.game.HasPlayedSupporter;
      },
    },
    {
      pattern: /^If 1 of your Pokémon used (.+?) during your last turn,/i,
      transform: (_, attackName) => {
        parser.conditionalForNextEffect = Effects.usedSpecificAttackLastTurn(attackName);
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

        parser.conditionalForNextEffect = (player, self) =>
          self.hasSufficientEnergy(secondaryRequiredEnergy);
      },
    },
    {
      pattern: /^If this Pokémon has damage on it,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) => self.isDamaged();
      },
    },
    {
      pattern: /^If this Pokémon has no damage on it,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) => !self.isDamaged();
      },
    },
    {
      pattern: /^If this Pokémon is affected by any Special Conditions,/i,
      transform: () => {
        effect.explicitConditions.push((player, self) => self.hasSpecialCondition());
      },
    },
    {
      pattern: /^If this Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) => self.AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If this Pokémon evolved during this turn,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) => self.PlayedThisTurn && self.Stage > 0;
      },
    },
    {
      pattern: /^If this Pokémon moved from your Bench to the Active Spot this turn,/i,
      transform: () => {
        parser.conditionalForNextEffect = Effects.selfMovedToActiveThisTurn;
      },
    },
    {
      pattern:
        /^If this Pokémon was damaged by an attack during your opponent’s last turn while it was in the Active Spot,/i,
      transform: () => {
        parser.conditionalForNextEffect = Effects.selfDamagedByAttackLastTurn;
      },
    },

    // Defending Pokémon conditionals
    {
      pattern: /^If your opponent’s Active Pokémon has damage on it,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().isDamaged();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has more remaining HP than this Pokémon,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().CurrentHP > self.CurrentHP;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is Poisoned,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().isPoisoned();
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon is affected by a Special Condition,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().hasSpecialCondition();
      },
    },
    {
      pattern: /^If (?:your opponent’s Active|the Defending) Pokémon is a ([^,]+?),/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        parser.conditionalForNextEffect = (player, self) =>
          predicate(self.opponent.activeOrThrow());
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has an Ability,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().Ability !== undefined;
      },
    },
    {
      pattern: /^If your opponent’s Active Pokémon has a Pokémon Tool attached,/i,
      transform: () => {
        parser.conditionalForNextEffect = (player, self) =>
          self.opponent.activeOrThrow().AttachedToolCards.length > 0;
      },
    },
    {
      pattern: /^If your opponent’s Pokémon is knocked out by damage from this attack,/i,
      transform: () => {
        parser.conditionalForNextEffect = Effects.opposingPokemonKnockedOutByCurrentAttack;
      },
    },

    // Player conditionals
    {
      pattern:
        /^If any of your Pokémon were knocked out by damage from an attack during your opponent’s last turn,/i,
      transform: () => {
        parser.conditionalForNextEffect = Effects.ownPokemonKnockedOutByAttackLastTurn;
      },
    },
    {
      pattern: /^If any of your (.+?) have damage on them,/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        parser.conditionalForNextEffect = (player, self) =>
          self.player.InPlayPokemon.some(predicate);
      },
    },
    {
      pattern: /^If (.+?) is on your Bench,/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        parser.conditionalForNextEffect = (player, self) =>
          self.player.BenchedPokemon.some(predicate);
      },
    },

    // Amount parsing
    {
      pattern: /for each(?: \{(\w)\})? Energy attached to this Pokémon/i,
      transform: (_, type) => {
        const fullType = type ? parseEnergy(type) : undefined;
        const predicate = fullType ? (e: Energy) => e == fullType : () => true;
        effect.passedAmount = (game, self) => self.EffectiveEnergy.filter(predicate).length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each Pokémon you have in play/i,
      transform: () => {
        effect.passedAmount = (game, self) => self.player.InPlayPokemon.length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each Energy attached to your opponent’s Active Pokémon/i,
      transform: () => {
        effect.passedAmount = (game, self) => self.opponent.activeOrThrow().EffectiveEnergy.length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each Energy attached to all of your opponent’s Pokémon/i,
      transform: () => {
        effect.passedAmount = (game, self) =>
          self.opponent.InPlayPokemon.flatMap((p) => p.EffectiveEnergy).length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each Energy in your opponent’s Active Pokémon’s Retreat Cost/i,
      transform: () => {
        effect.passedAmount = (game, self) => self.opponent.effectiveRetreatCost;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each of your opponent’s Benched Pokémon/i,
      transform: () => {
        effect.passedAmount = (game, self) => self.opponent.BenchedPokemon.length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each of your ([^.]+?)(?: in play)?(?=[,.])/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.passedAmount = (game, self) => self.player.InPlayPokemon.filter(predicate).length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each ([^.]+) on your Bench/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.passedAmount = (game, self) => self.player.BenchedPokemon.filter(predicate).length;
        return "for each <amount>";
      },
    },
    {
      pattern: /for each time your Pokémon used (.+?) during this game/i,
      transform: (_, attackName) => {
        effect.passedAmount = (game, self) => Effects.countTimesAttackUsed(game, self, attackName);
        return "for each <amount>";
      },
    },

    // Damage-determining effects
    {
      pattern: /^this attack does (\d+) more damage\./i,
      transform: (_, extraDamage) => {
        if (parser.conditionalForNextEffect === undefined) {
          parser.parseSuccessful = false;
          return;
        }
        const prevConditional = parser.conditionalForNextEffect;
        parser.conditionalForNextEffect = undefined;
        effect.calculateDamage = (game, self) =>
          baseDamage + (prevConditional(self.player, self, 0) ? Number(extraDamage) : 0);
      },
    },
    {
      pattern: /^This attack does (\d+)( more)? damage for each <amount>\./i,
      transform: (_, damagePer, more) => {
        effect.calculateDamage = (game, self, amount) => {
          return (more ? baseDamage : 0) + amount * Number(damagePer);
        };
      },
    },
    {
      pattern:
        /^You may discard any number of your (Benched .+?)\. This attack does (\d+) more damage for each Benched Pokémon you discarded in this way\./i,
      transform: (_, descriptor, damage) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.preDamageEffects.push(async (game, self) => {
          const validPokemon = self.player.BenchedPokemon.filter(predicate);
          const prompt = "Choose any number of your Benched Pokémon to discard.";
          const chosenPokemon = await game.chooseNPokemon(self.player, validPokemon, null, prompt);
          for (const p of chosenPokemon) {
            await self.player.discardPokemonFromPlay(p);
          }
        });
        effect.calculateDamage = (game, self) => {
          const discardedCount = Effects.pokemonDiscardedFromPlayByCurrentAttack(game, self);
          return baseDamage + discardedCount * +damage;
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
        parser.addSideEffect(async (game, self) => {
          await game.knockOutPokemon(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern: /^do (\d+) damage to (?:the Attacking Pokémon|your opponent’s Active Pokémon)\.$/i,
      transform: (_, damage) => {
        parser.addSideEffect(async (game, self) => {
          game.applyDamage(self.opponent.activeOrThrow(), Number(damage), false);
        });
      },
    },

    // Damage to opponent’s bench
    {
      pattern:
        /^This attack also does (\d+) damage to each of your( opponent’s)? (Benched [^.]+?)\./i,
      transform: (_, benchDamage, opponent, descriptor) => {
        const dmg = Number(benchDamage);
        const predicate = parser.parsePokemonPredicate(descriptor);
        const benchDamageEffect = parser.applyConditionalIfAvailable(async (game, self) => {
          const player = opponent ? self.opponent : self.player;
          for (const p of player.BenchedPokemon) {
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
        const predicate = parser.parsePokemonPredicate(descriptor);

        effect.validTargets = (player) => player.opponent.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(async (game, self, amount, target) => {
          if (!target) return;
          const energyCount = target.EffectiveEnergy.length;
          game.attackPokemon(target, energyCount * Number(damagePerEnergy));
        });
      },
    },
    {
      pattern: /^This attack(?: also)? does (\d+) damage to 1 of your opponent’s (.+?)\./i,
      transform: (_, damage, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.opponent.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },
    {
      pattern: /^This attack does (\d+) damage to each of your opponent’s Pokémon\./i,
      transform: (_, damage) => {
        const dmg = Number(damage);
        const attackEffect = parser.applyConditionalIfAvailable(async (game, self) => {
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
        parser.addSideEffect(async (game, self) => {
          game.applyDamage(self.opponent.activeOrThrow(), Number(damage), false);
        });
      },
    },
    {
      pattern: /^do (\d+) damage to 1 of your opponent’s Pokémon\.$/i,
      transform: (_, damage) => {
        effect.validTargets = (player) => player.opponent.InPlayPokemon;
        parser.addSideEffect(async (game, self, amount, target) => {
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
        const selfAttackEffect = parser.applyConditionalIfAvailable(async (game, self) => {
          game.applyDamage(self, dmg, true);
        });
        effect.attackingEffects.push(selfAttackEffect);
      },
    },
    {
      pattern: /^This attack also does (\d+) damage to 1 of your (.+?)\./i,
      transform: (_, damage, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        effect.attackingEffects.push(attackTargetIfExists(Number(damage)));
      },
    },
    {
      pattern: /^If you do, do (\d+) damage to this Pokémon\./i,
      transform: (_, damage) => {
        parser.addSideEffect(async (game, self) => {
          game.applyDamage(self, Number(damage), false);
        });
      },
    },

    // Healing effects
    {
      pattern: /^Heal (\d+) damage from (?:it|(?:this|that) Pokémon)\./i,
      transform: (_, healing) => {
        effect.implicitConditions.push((player, self) => self.isDamaged());
        parser.addSideEffect(async (game, self) => {
          self.healDamage(Number(healing));
        });
      },
    },
    {
      pattern:
        /^Heal from this Pokémon the same amount of damage you did to your opponent’s Active Pokémon\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          const damageDealt = Effects.damageDoneToOpposingPokemonByCurrentAttack(game, self);
          if (damageDealt !== undefined) self.healDamage(damageDealt);
        });
      },
    },
    {
      pattern: /^Heal (\d+) damage from each of your (.+?)\./i,
      transform: (_, healing, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.implicitConditions.push((player) => player.InPlayPokemon.some(predicate));
        parser.addSideEffect(async (game, self) => {
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
        parser.addSideEffect(async (game, self) => {
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
        parser.addSideEffect(async (game, self) => {
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
        const predicate = parser.parsePokemonPredicate(
          descriptor,
          (p) => p.isDamaged() || p.hasSpecialCondition(),
        );
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          target.healDamage(Number(modifier));
          target.removeAllSpecialConditions();
        });
      },
    },
    {
      pattern: /^it recovers from all of them, and discard this card\.$/i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
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
        const predicate = parser.parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          if (target.isDamaged()) target.healDamage(Number(healing));
        });
      },
    },
    {
      pattern:
        /^Heal all damage from 1 of your ([^.]+?)\. If you do, discard all Energy from that Pokémon\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor, (p) => p.isDamaged());
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          target.healDamage(target.MaxHP - target.CurrentHP);
          await game.discardAllEnergy(target);
        });
      },
    },
    {
      pattern: /^move (\d+) of its damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, damage) => {
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          const damageHealed = target.healDamage(Number(damage));
          game.applyDamage(self.opponent.activeOrThrow(), damageHealed, false);
        });
      },
    },
    {
      pattern:
        /^choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon\.$/i,
      transform: () => {
        parser.addSideEffect(async (game, self, amount, target) => {
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
        parser.addSideEffect(async (game, self) => {
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
        parser.addSideEffect(async (game, self) => self.player.drawCards(cardCount));
      },
    },
    {
      pattern:
        /^Draw cards until you have the same number of cards in your hand as your opponent\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          const cardsToDraw = self.opponent.Hand.length - self.player.Hand.length;
          if (cardsToDraw > 0) self.player.drawCards(cardsToDraw);
          else game.GameLog.conditionNotMet(self.player);
        });
      },
    },
    {
      pattern:
        /^Shuffle your hand into your deck\. Draw a card for each card in your opponent’s hand\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          self.player.shuffleHandIntoDeck();
          self.player.drawCards(self.opponent.Hand.length);
        });
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your deck into your hand\./i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.canDraw(true));
        parser.addSideEffect(async (game, self) => {
          self.player.drawRandomFilteredToHand(predicate);
        });
      },
    },
    {
      pattern: /^Put 1 random (.+?) from your deck onto your bench\./i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push(
          (player) => player.canDraw(true) && player.Bench.some((p) => !p.isPokemon),
        );
        parser.addSideEffect(async (game, self) => {
          await self.player.playRandomFilteredToBench(predicate);
        });
      },
    },
    {
      pattern:
        /^Look at the top card of your deck\. If that card is a (.+?), put it into your hand\. If it is not a \1, put it on the bottom of your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);

        effect.implicitConditions.push((player) => player.canDraw(true));
        parser.addSideEffect(Effects.MythicalSlab(predicate));
      },
    },
    {
      pattern:
        /^For each <amount>, look at that many cards from the top of your( opponent’s)? deck and put them back in any order\./i,
      transform: (_, opponent) => {
        effect.implicitConditions.push(
          (player, self, amount) => amount > 0,
          (player) => (opponent ? player.opponent : player).Deck.length > 0,
        );
        parser.addSideEffect(Effects.HikerAndMorty(!!opponent));
      },
    },
    {
      pattern: /^Choose a (.+?) in your hand and switch it with a random \1 in your deck\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push(
          (player) => player.Hand.some(predicate) && player.Deck.length > 0,
        );
        parser.addSideEffect(Effects.PokemonCommunication(predicate));
      },
    },
    {
      pattern: /^Put (?:a|1) random (.+?) from your discard pile into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Discard.some(predicate));
        parser.addSideEffect(async (game, self) => {
          const validCards = self.player.Discard.filter(predicate);
          const card = randomElement(validCards);
          self.player.returnFromDiscardToHand([card]);
        });
      },
    },
    {
      pattern:
        /^For each heads, a (.+?) is chosen at random from your discard pile and put into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        effect.implicitConditions.push((player) => player.Discard.some(predicate));
        parser.addSideEffect(async (game, self, amount) => {
          const validCards = self.player.Discard.filter(predicate);
          const cards = randomElements(validCards, amount);
          self.player.returnFromDiscardToHand(cards);
        });
      },
    },
    {
      pattern: /^Discard the top (\d+) cards of your deck\./i,
      transform: (_, count) => {
        parser.addSideEffect(async (game, self) => {
          self.player.discardTopOfDeck(Number(count));
        });
      },
    },

    // Opponent card manipulation
    {
      pattern: /^Your opponent shuffles their hand into their deck and draws (\d+) cards\.$/i,
      transform: (_, count) => {
        parser.addSideEffect(async (game, self) => {
          self.opponent.shuffleHandIntoDeckAndDraw(Number(count));
        });
      },
    },
    {
      pattern:
        /^Your opponent shuffles their hand into their deck and draws a card for each of their remaining points needed to win\.$/i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          const cardsToDraw = game.GameRules.PrizePoints - self.opponent.GamePoints;
          self.opponent.shuffleHandIntoDeckAndDraw(cardsToDraw);
        });
      },
    },
    {
      pattern:
        /^Each player shuffles the cards in their hand into their deck, then draws that many cards\.$/i,
      transform: () => {
        parser.addSideEffect(async (game) => {
          game.DefendingPlayer.shuffleHandIntoDeckAndDraw(game.DefendingPlayer.Hand.length);
          game.AttackingPlayer.shuffleHandIntoDeckAndDraw(game.AttackingPlayer.Hand.length);
        });
      },
    },
    {
      pattern: /^discard a random (.+?) from your opponent’s hand\./i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        parser.addSideEffect(async (game, self) => {
          self.opponent.discardRandomFiltered(predicate);
        });
      },
    },
    {
      pattern:
        /^Your opponent reveals their hand\. Choose a (.*?card) you find there and shuffle it into your opponent’s deck\./i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        const prompt = `Choose a ${descriptor} from your opponent's hand to shuffle into their deck.`;
        parser.addSideEffect(async (game, self) => {
          const card = await game.chooseFilteredCard(
            self.player,
            self.opponent.Hand,
            predicate,
            prompt,
          );
          if (!card) return;
          self.opponent.returnFromHandToDeck([card]);
        });
      },
    },
    {
      pattern:
        /^your opponent reveals a random card from their hand and shuffles it into their deck\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          if (self.opponent.Hand.length === 0) return;
          const card = randomElement(self.opponent.Hand);
          await game.showCards(self.player, [card]);
          self.opponent.returnFromHandToDeck([card]);
        });
      },
    },
    {
      pattern:
        /^For each heads, a card is chosen at random from your opponent’s hand\. Your opponent reveals that card and shuffles it into their deck\./i,
      transform: () => {
        parser.addSideEffect(async (game, self, amount) => {
          if (self.opponent.Hand.length === 0 || amount === 0) return;
          const cards = [];
          while (amount-- > 0 && self.opponent.Hand.length > 0) {
            cards.push(randomElement(self.opponent.Hand));
          }
          await game.showCards(self.player, cards);
          self.opponent.returnFromHandToDeck(cards);
        });
      },
    },
    {
      pattern: /^Your opponent reveals their hand\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.opponent.Hand);
        });
      },
    },
    {
      pattern: /^Your opponent reveals all of the (.+?) in their deck\./i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePlayingCardPredicate(descriptor);
        parser.addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.opponent.Deck.filter(predicate));
          self.opponent.shuffleDeck();
        });
      },
    },
    {
      pattern:
        /^Look at a random Supporter card that’s not Penny from your opponent’s deck and shuffle it back into their deck\. Use the effect of that card as the effect of this card\./i,
      transform: () => {
        parser.addSideEffect(Effects.Penny);
      },
    },
    {
      pattern: /^Discard the top (\d+) cards of each player’s deck\./i,
      transform: (_, count) => {
        parser.addSideEffect(async (game, self) => {
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
        parser.addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.player.Deck.slice(0, Number(count)));
        });
      },
    },
    {
      pattern: /^Look at the top card of your deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        parser.addSideEffect(async (game, self) => {
          await game.showCards(self.player, self.player.Deck.slice(0, 1));
        });
      },
    },
    {
      pattern: /^Then, you may shuffle your deck\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          const choice = await game.chooseYesNo(self.player, "Shuffle deck?");
          if (choice) self.player.shuffleDeck();
        });
      },
    },
    {
      pattern: /^choose either player\. Look at the top card of that player’s deck\./i,
      transform: () => {
        effect.implicitConditions.push((player) => player.Deck.length > 0);
        parser.addSideEffect(async (game, self) => {
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

        parser.addSideEffect(async (game, self) => game.discardEnergy(self, fullType, energyCount));
      },
    },
    {
      pattern: /^Discard (a|\d+) random Energy from this Pokémon\./i,
      transform: (_, count) => {
        const energyCount = count == "a" ? 1 : Number(count);
        parser.addSideEffect(async (game, self) => game.discardRandomEnergy(self, energyCount));
      },
    },
    {
      pattern: /^Discard a (.+?) Energy from this Pokémon\./i,
      transform: (_, energyType) => {
        const fullType = parseEnergies(energyType);
        parser.addSideEffect(async (game, self) => await game.discardEnergy(self, fullType));
      },
    },
    {
      pattern: /^Discard all Energy (?:from|attached to) this Pokémon\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => game.discardAllEnergy(self));
      },
    },
    {
      pattern: /^Discard a random Energy from your opponent’s Active Pokémon\./i,
      transform: () => {
        effect.implicitConditions.push(
          (player, self) => self.opponent.activeOrThrow().EffectiveEnergy.length > 0,
        );
        parser.addSideEffect(
          async (game, self) => await game.discardRandomEnergy(self.opponent.activeOrThrow()),
        );
      },
    },
    {
      pattern: /^Discard a \{(\w)\} Energy from your opponent’s Active Pokémon\./i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);
        effect.implicitConditions.push((player, self) =>
          self.opponent.activeOrThrow().EffectiveEnergy.some((e) => e === fullType),
        );
        parser.addSideEffect(
          async (game, self) =>
            await game.discardEnergy(self.opponent.activeOrThrow(), fullType, 1),
        );
      },
    },
    {
      pattern: /^For each heads, discard a random Energy from your opponent’s Active Pokémon\.$/i,
      transform: () => {
        effect.implicitConditions.push(
          (player, self) => self.opponent.activeOrThrow().EffectiveEnergy.length > 0,
        );
        parser.addSideEffect(
          async (game, self, amount) =>
            await game.discardRandomEnergy(self.opponent.activeOrThrow(), amount),
        );
      },
    },
    {
      pattern: /^Discard a random Energy from both Active Pokémon\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await game.discardRandomEnergy(game.AttackingPlayer.activeOrThrow());
          await game.discardRandomEnergy(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern:
        /^Discard a random Energy from among the Energy attached to all Pokémon \(both yours and your opponent’s\)\./i,
      transform: () => {
        parser.addSideEffect(async (game) => {
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

        parser.addSideEffect(async (game, self) => {
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
          const predicate = parser.parsePokemonPredicate(descriptor);
          effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        }

        parser.addSideEffect(async (game, self, amount, target) => {
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
        const predicate = parser.parsePokemonPredicate(descriptor);

        parser.addSideEffect(async (game, self) => {
          const pokemon = self.player.InPlayPokemon.filter(predicate);
          const prompt = "Choose 2 of your Pokémon to attach Energy to.";
          const chosenPokemon = await game.chooseNPokemon(self.player, pokemon, 2, prompt);
          for (const p of chosenPokemon) await self.player.attachEnergy(p, [energy], "energyZone");
        });
      },
    },
    {
      pattern:
        /^Take an amount of \{(\w)\} Energy from your Energy Zone equal to the number of heads and attach it to your ([^.]+?) in any way you like\./i,
      transform: (_, energyType, pokemonSpecifier) => {
        const et = parseEnergy(energyType);
        const predicate = parser.parsePokemonPredicate(pokemonSpecifier);

        parser.addSideEffect(async (game, self, amount) => {
          const validPokemon = self.player.InPlayPokemon.filter(predicate);
          await game.distributeEnergy(self.player, new Array(amount).fill(et), validPokemon);
        });
      },
    },
    {
      pattern:
        /^Take a (.+) Energy from your Energy Zone and attach them to your ([^.]+?) in any way you like\./i,
      transform: (_, energyTypes, pokemonSpecifier) => {
        const et = parseEnergies(energyTypes);
        const predicate = parser.parsePokemonPredicate(pokemonSpecifier);

        parser.addSideEffect(async (game, self) => {
          const validPokemon = self.player.InPlayPokemon.filter(predicate);
          await game.distributeEnergy(self.player, et, validPokemon);
        });
      },
    },
    {
      pattern:
        /^For each heads, take a {(\w)} Energy from your Energy Zone and attach it to that Pokémon\.$/i,
      transform: (_, energyType) => {
        const et = parseEnergy(energyType);

        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          await self.player.attachEnergy(target, new Array(amount).fill(et), "energyZone");
        });
      },
    },
    {
      pattern:
        /^Attach (a|\d+) (?:\{(\w)\}|random) Energy from your discard pile to (this|that) Pokémon\./i,
      transform: (_, count, energyType, targeting) => {
        const amount = count === "a" ? 1 : Number(count);
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        const energyFilter = (e: Energy) => fullType === undefined || e === fullType;

        effect.implicitConditions.push((player) => player.DiscardedEnergy.some(energyFilter));
        parser.addSideEffect(async (game, self, _, target) => {
          target = targeting === "this" ? self : target;
          if (!target) return;
          const energyToAttach: Energy[] = [];
          for (let i = 0; i < amount; i++) {
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
        const predicate = parser.parsePokemonPredicate(descriptor);

        effect.implicitConditions.push((player) => predicate(player.activeOrThrow()));
        parser.addSideEffect(async (game, self) => {
          for (const pokemon of self.player.BenchedPokemon) {
            const energyToMove = pokemon.getEnergy(fullType);
            if (energyToMove.length > 0) {
              await self.player.transferEnergy(pokemon, self.player.activeOrThrow(), energyToMove);
            }
          }
        });
      },
    },
    {
      pattern:
        /^move (an?|all)(?: (.+?))? Energy from 1 of your (Benched .+?) to your Active (.+?)\./i,
      transform: (_, amount, energyTypes, benchedSpecifier, activeSpecifier) => {
        const fullTypes = energyTypes ? parseEnergies(energyTypes) : undefined;
        const benchPredicate = parser.parsePokemonPredicate(benchedSpecifier, (p) =>
          p.hasAnyEnergy(fullTypes),
        );
        const activePredicate = parser.parsePokemonPredicate(activeSpecifier);

        effect.implicitConditions.push((player) => activePredicate(player.activeOrThrow()));
        effect.validTargets = (player) => player.BenchedPokemon.filter(benchPredicate);

        parser.addSideEffect(async (game, self, _, target) => {
          if (!target) return;
          const active = self.player.activeOrThrow();

          const prompt = "Choose an Energy to move.";
          const validEnergy = target.getEnergy(fullTypes);
          const energyToMove =
            amount === "all"
              ? validEnergy
              : await game.chooseNEnergy(self.player, validEnergy, 1, prompt);

          await self.player.transferEnergy(target, active, energyToMove);
        });
      },
    },
    {
      pattern: /^move all(?: \{(\w)\})? Energy from this Pokémon to 1 of your (.+?)\./i,
      transform: (_, energyType, descriptor) => {
        const fullType = energyType ? parseEnergy(energyType) : undefined;
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.implicitConditions.push((player, self) => self.hasAnyEnergy(fullType));
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          const energyToMove = self.getEnergy(fullType);
          await self.player.transferEnergy(self, target, energyToMove);
        });
      },
    },
    {
      pattern:
        /^move 2 \{(\w)\} Energy from that Pokémon and attach 1 Energy each to 2 of your ([^.]+?)\./i,
      transform: (_, type, descriptor) => {
        const energy = parseEnergy(type);
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.implicitConditions.push(
          (player, pokemon) =>
            pokemon.hasAnyEnergy(energy) && player.InPlayPokemon.filter(predicate).length > 0,
        );

        parser.addSideEffect(async (game, self) => {
          const count = Math.min(2, self.getEnergy(energy).length);
          const pokemon = self.player.InPlayPokemon.filter(predicate);
          const prompt = `Choose ${count} Pokémon to transfer Energy to.`;
          const chosenPokemon = await game.chooseNPokemon(self.player, pokemon, count, prompt);
          for (const p of chosenPokemon) await self.player.transferEnergy(self, p, [energy]);
        });
      },
    },

    // Pokemon Tool effects
    {
      pattern: /^Discard all Pokémon Tool cards attached to each of your opponent’s Pokémon\./i,
      transform: () => {
        effect.implicitConditions.push((player) =>
          player.opponent.InPlayPokemon.some((p) => p.AttachedToolCards.length > 0),
        );
        parser.addSideEffect(async (game, self) => {
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
          const activePredicate = parser.parsePokemonPredicate(activeDescriptor);
          effect.implicitConditions.push((player) => activePredicate(player.activeOrThrow()));
        }

        const benchPredicate = parser.parsePokemonPredicate(benchDescriptor);
        effect.validTargets = (player) => player.BenchedPokemon.filter(benchPredicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          await self.player.swapActivePokemon(target, "selfEffect");
        });
      },
    },
    {
      pattern: /^switch it with your Active Pokémon\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await self.player.swapActivePokemon(self, "selfEffect");
        });
      },
    },
    {
      pattern: /^Put your (.+?) in the Active Spot into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);

        effect.implicitConditions.push((player) => predicate(player.activeOrThrow()));
        parser.addSideEffect(async (game, self) => {
          await self.player.returnPokemonToHand(self.player.activeOrThrow());
        });
      },
    },
    {
      pattern: /^Put 1 of your (.+?) into your hand\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);

        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          await self.player.returnPokemonToHand(target);
        });
      },
    },
    {
      pattern:
        /^Switch out your opponent’s Active (.+?) to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.implicitConditions.push(
          (player) =>
            predicate(player.opponent.activeOrThrow()) && player.opponent.BenchedPokemon.length > 0,
        );
        parser.addSideEffect(async (game, self) => {
          await game.chooseNewActivePokemon(self.opponent);
        });
      },
    },
    {
      pattern: /^Switch in 1 of your opponent’s (.+?) to the Active Spot\.$/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.opponent.BenchedPokemon.filter(predicate);
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          await self.opponent.swapActivePokemon(target, "opponentEffect", self.player.Name);
        });
      },
    },
    {
      pattern: /^your opponent shuffles their Active Pokémon into their deck\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await self.opponent.shufflePokemonIntoDeck(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern: /^put your opponent’s Active Pokémon into their hand\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
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
            player.opponent.Discard.some((card) => card.CardType == "Pokemon" && card.Stage == 0),
        );
        parser.addSideEffect(async (game, self) => {
          const benchIndex = self.opponent.Bench.findIndex((slot) => !slot.isPokemon);
          if (benchIndex < 0) return;
          const validCards = self.opponent.Discard.filter(
            (card) => card.CardType == "Pokemon" && card.Stage == 0,
          );
          const prompt = "Choose a Basic Pokémon to put on your opponent's Bench.";
          const card = await game.chooseCard(self.player, validCards, prompt);
          if (!card) return;
          await self.opponent.putPokemonOnBench(card as PokemonCard, benchIndex, card);
        });
      },
    },
    {
      pattern:
        /^Choose 1 of your Basic Pokémon in play\. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1\. You can’t use this card during your first turn or on a Basic Pokémon that was put into play this turn\.$/i,
      transform: () => {
        effect.validTargets = Effects.findValidRareCandyTargets;
        parser.addSideEffect(async (game, self, amount, target) => {
          if (!target) return;
          await Effects.evolveWithRareCandy(target);
        });
      },
    },

    // Special Condition effects
    {
      pattern:
        /^Your opponent’s Active Pokémon is now Poisoned\. Do 20 damage to this Pokémon instead of the usual amount for this Special Condition\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.poisonDefendingPokemon(true));
      },
    },
    {
      pattern: /^(?:make )?your opponent’s Active Pokémon (?:is now )?Poisoned\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.poisonDefendingPokemon(false));
      },
    },
    {
      pattern: /^the Attacking Pokémon is now Poisoned\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.AttackingPlayer.poisonActivePokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Burned\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.burnDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Poisoned and Burned\./i,
      transform: () => {
        parser.addSideEffect(async (game) => {
          game.poisonDefendingPokemon(false);
          game.burnDefendingPokemon();
        });
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Asleep\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.sleepDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Paralyzed\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.paralyzeDefendingPokemon());
      },
    },
    {
      pattern: /^Your opponent’s Active Pokémon is now Confused\./i,
      transform: () => {
        parser.addSideEffect(async (game) => game.confuseDefendingPokemon());
      },
    },
    {
      pattern: /^This Pokémon is now Confused\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => self.player.confuseActivePokemon());
      },
    },
    {
      pattern:
        /^1 Special Condition from among Asleep, Burned, Confused, Paralyzed, and Poisoned is chosen at random, and your opponent’s Active Pokémon is now affected by that Special Condition\. Any Special Conditions already affecting that Pokémon will not be chosen\.$/i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          Effects.applyRandomSpecialCondition(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern: /^(?:This Pokémon|it) is now Asleep\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => self.player.sleepActivePokemon());
      },
    },

    // Status effect headers
    {
      pattern: /^During this turn, /i,
      transform: () => {
        parser.turnsToKeep = 0;
      },
    },
    {
      pattern: / ?During (your opponent’s|their) next turn(?:, )?/i,
      transform: () => {
        parser.turnsToKeep = 1;
      },
    },
    {
      pattern: /^During your next turn, /i,
      transform: () => {
        parser.turnsToKeep = 2;
      },
    },

    // Self Pokémon status effects
    {
      pattern:
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon for each point you have gotten\.$/i,
      transform: (_, amount) => {
        effect.implicitConditions.push((player) => player.GamePoints >= 1);
        parser.addSelfPokemonStatus(
          PokemonStatus.ModifyAttackDamage({
            descriptor: "+10 damage for each point you have gotten",
            calc: (self) => +amount * self.player.GamePoints,
          }),
        );
      },
    },
    {
      pattern:
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, amount) => {
        parser.addSelfPokemonStatus(PokemonStatus.ModifyAttackDamage(+amount));
      },
    },
    {
      pattern:
        /^this Pokémon takes −(\d+) damage from attacks from your opponent’s Pokémon, recovers from all Special Conditions, and can’t be affected by any Special Conditions\.$/i,
      transform: (_, amount) => {
        parser.addSelfPokemonStatus(
          PokemonStatus.ModifyIncomingAttackDamage(-amount, parser.turnsToKeep),
        );
        parser.addSelfPokemonStatus(PokemonStatus.PreventSpecialConditions(parser.turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon takes (−|\+)(\d+) damage from attacks(?: from ([^.]+?))?\./i,
      transform: (_, sign, amount, descriptor) => {
        const trueAmount = +amount * (sign === "+" ? 1 : -1);
        parser.addSelfPokemonStatus(
          PokemonStatus.ModifyIncomingAttackDamage(trueAmount, parser.turnsToKeep, descriptor),
        );
      },
    },
    {
      pattern:
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, this Pokémon takes −(\d+) damage from that attack\.$/i,
      transform: (_, amount) => {
        parser.addSelfPokemonStatus(PokemonStatus.ModifyIncomingAttackDamageOnCoinFlip(-amount));
      },
    },
    {
      pattern:
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, prevent that damage\.$/i,
      transform: () => {
        parser.addSelfPokemonStatus(
          PokemonStatus.PreventAttackDamageOnCoinFlip(parser.turnsToKeep),
        );
      },
    },
    {
      pattern:
        /^prevent all damage done to this Pokémon by attacks(?: from your opponent’s (.+?))?\./i,
      transform: (_, descriptor) => {
        parser.addSelfPokemonStatus(
          PokemonStatus.PreventAttackDamage(parser.turnsToKeep, descriptor),
        );
      },
    },
    {
      pattern:
        /^prevent all effects of attacks used by your opponent’s Pokémon done to this Pokémon\./i,
      transform: () => {
        parser.addSelfPokemonStatus(PokemonStatus.PreventAttackEffects(parser.turnsToKeep));
      },
    },
    {
      pattern: /^prevent all damage from—and effects of—attacks done to this Pokémon\./i,
      transform: () => {
        parser.addSelfPokemonStatus(
          PokemonStatus.PreventAttackDamageAndEffects(parser.turnsToKeep),
        );
      },
    },
    {
      pattern:
        /^if this Pokémon is damaged by an attack, do (\d+) damage to the Attacking Pokémon\./i,
      transform: (_, damage) => {
        parser.addSelfPokemonStatus(PokemonStatus.CounterAttack(+damage, parser.turnsToKeep));
      },
    },
    {
      pattern: /^This Pokémon can’t be affected by any Special Conditions\./i,
      transform: () => {
        parser.addSelfPokemonStatus(PokemonStatus.PreventSpecialConditions(parser.turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon can’t attack\./i,
      transform: () => {
        parser.addSelfPokemonStatus(PokemonStatus.CannotAttack(parser.turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon can’t use (.+?)\./i,
      transform: (_, attackName) => {
        parser.addSelfPokemonStatus(
          PokemonStatus.CannotUseSpecificAttack(attackName, parser.turnsToKeep),
        );
      },
    },
    {
      pattern: /^this Pokémon’s (.+?) attack does \+(\d+) damage\./i,
      transform: (_, attackName, increaseAmount) => {
        parser.addSelfPokemonStatus(
          PokemonStatus.ModifyDamageOfAttack(attackName, +increaseAmount, parser.turnsToKeep),
        );
      },
    },
    {
      pattern: /^attacks used by this Pokémon cost (\d+) less {(\w)} Energy\./i,
      transform: (_, amount, energyType) => {
        const fullType = parseEnergy(energyType);
        parser.addSelfPokemonStatus(
          PokemonStatus.ModifyAttackCost(fullType, -amount, parser.turnsToKeep),
        );
      },
    },
    {
      pattern: /^(it|this Pokémon) has no Retreat Cost\.$/i,
      transform: () => {
        parser.addSelfPokemonStatus(PokemonStatus.NoRetreatCost(parser.turnsToKeep));
      },
    },
    {
      pattern: /^this Pokémon gets \+(\d+) HP\.$/i,
      transform: (_, amount) => {
        parser.addSelfPokemonStatus(PokemonStatus.IncreaseMaxHP(+amount, parser.turnsToKeep));
      },
    },
    {
      pattern:
        /^This Pokémon can evolve into any Pokémon that evolves from (.+?) if you play it from your hand onto this Pokémon\. \(This Pokémon can’t evolve during your first turn or the turn you play it\.\)$/,
      transform: (_, pokemonName) => {
        parser.addSelfPokemonStatus(PokemonStatus.CanEvolveAs(pokemonName));
      },
    },

    // Defending Pokémon status effects
    {
      pattern: /^attacks used by the Defending Pokémon do −(\d+) damage\./i,
      transform: (_, damageReduction) => {
        parser.addOpponentPokemonStatus(
          PokemonStatus.ModifyAttackDamage(-damageReduction, parser.turnsToKeep),
        );
      },
    },
    {
      pattern: /^(?:it|the Defending Pokémon) can’t attack\./i,
      transform: () => {
        parser.addOpponentPokemonStatus(PokemonStatus.CannotAttack(parser.turnsToKeep));
      },
    },
    {
      pattern: /^the Defending Pokémon can’t retreat\./i,
      transform: () => {
        parser.addOpponentPokemonStatus(PokemonStatus.CannotRetreat(parser.turnsToKeep));
      },
    },
    {
      pattern:
        /^if the Defending Pokémon tries to use an attack, your opponent flips a coin\. If tails, that attack doesn’t happen\./i,
      transform: () => {
        parser.addOpponentPokemonStatus(PokemonStatus.CoinFlipToAttack(parser.turnsToKeep));
      },
    },
    {
      pattern:
        /^attacks used by the Defending Pokémon cost (\d+) {(\w)} more, and its Retreat Cost is (\d+) {C} more\./i,
      transform: (_, attackCostModifier, type, retreatCostModifier) => {
        parser.addOpponentPokemonStatus(
          PokemonStatus.ModifyAttackCost(
            parseEnergy(type),
            +attackCostModifier,
            parser.turnsToKeep,
          ),
        );
        parser.addOpponentPokemonStatus(
          PokemonStatus.ModifyRetreatCost(+retreatCostModifier, parser.turnsToKeep),
        );
      },
    },

    // Self player effects
    {
      pattern: /^the Retreat Cost of your (.+?) is (\d+) less\.$/i,
      transform: (_, descriptor, modifier) => {
        parser.addSelfPlayerPokemonStatus(
          PokemonStatus.ModifyRetreatCost(-modifier, parser.turnsToKeep),
          descriptor,
        );
      },
    },
    {
      pattern: /^attacks used by your (.+?) do \+(\d+) damage to your opponent’s (.+?)\.$/i,
      transform: (_, selfSpecifier, modifier, opponentSpecifier) => {
        parser.addSelfPlayerPokemonStatus(
          PokemonStatus.ModifyAttackDamage(+modifier, parser.turnsToKeep, opponentSpecifier),
          selfSpecifier,
        );
      },
    },
    {
      pattern: /^attacks used by your (.+?) cost (\d+) less {(\w)} Energy\.$/i,
      transform: (_, descriptor, count, energy) => {
        parser.addSelfPlayerPokemonStatus(
          PokemonStatus.ModifyAttackCost(parseEnergy(energy), -count, parser.turnsToKeep),
          descriptor,
        );
      },
    },
    {
      pattern:
        /^all of your (.+?) take −(\d+) damage from attacks from your opponent’s Pokémon\.$/i,
      transform: (_, descriptor, modifier) => {
        parser.addSelfPlayerPokemonStatus(
          PokemonStatus.ModifyIncomingAttackDamage(-modifier),
          descriptor,
        );
      },
    },
    {
      pattern: /^your (Active .+?)’s Retreat Cost is (\d+) less\./i,
      transform: (_, descriptor, amount) => {
        parser.addSelfPlayerPokemonStatus(PokemonStatus.ModifyRetreatCost(-amount), descriptor);
      },
    },
    {
      pattern: /^your (Active .+?) has no Retreat Cost\./i,
      transform: (_, descriptor) => {
        parser.addSelfPlayerPokemonStatus(PokemonStatus.NoRetreatCost(), descriptor);
      },
    },
    {
      pattern:
        /^Each of your (.+?) recovers from all Special Conditions and can’t be affected by any Special Conditions\.$/i,
      transform: (_, descriptor) => {
        parser.addSelfPlayerPokemonStatus(PokemonStatus.PreventSpecialConditions(), descriptor);
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your (.+?) provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);

        parser.addSelfPlayerPokemonStatus(PokemonStatus.DoubleEnergy(fullType), descriptor, true);
      },
    },
    {
      pattern:
        /^The next time you flip any number of coins for the effect of an attack, Ability, or Trainer card after using this card on this turn, the first coin flip will definitely be heads\.$/,
      transform: () => {
        parser.addSelfPlayerStatus(PlayerStatus.NextCoinFlip(true, false));
      },
    },

    // Both player effects
    {
      pattern: /^Pokémon \(both yours and your opponent’s\) can’t be healed\.$/i,
      transform: () => {
        parser.addSelfPlayerPokemonStatus(PokemonStatus.CannotHeal(parser.turnsToKeep), "Pokémon");
        parser.addOpponentPlayerPokemonStatus(
          PokemonStatus.CannotHeal(parser.turnsToKeep),
          "Pokémon",
        );
      },
    },

    // Opponent player effects
    {
      pattern: /^attacks used by your opponent’s (.+?) do −(\d+) damage\./i,
      transform: (_, descriptor, damageReduction) => {
        parser.addOpponentPlayerPokemonStatus(
          PokemonStatus.ModifyAttackDamage(-damageReduction, parser.turnsToKeep),
          descriptor,
        );
      },
    },
    {
      pattern: /^attacks used by your opponent’s (.+?) cost (\d+) \{C\} more\./i,
      transform: (_, descriptor, modifier) => {
        parser.addOpponentPlayerPokemonStatus(
          PokemonStatus.ModifyAttackCost("Colorless", +modifier, parser.turnsToKeep),
          descriptor,
        );
      },
    },
    {
      pattern: /^Your opponent can’t use any Supporter cards from their hand\./i,
      transform: () => {
        parser.addOpponentPlayerStatus(
          PlayerStatus.CannotUseSupporter(
            parser.turnsToKeep !== undefined && parser.turnsToKeep > 0,
          ),
        );
      },
    },
    {
      pattern: /^they can’t play any Item cards from their hand\./i,
      transform: () => {
        parser.addOpponentPlayerStatus(
          PlayerStatus.CannotUseItem(parser.turnsToKeep !== undefined && parser.turnsToKeep > 0),
        );
      },
    },
    {
      pattern: /^Your opponent can’t play any Pokémon from their hand to evolve their (.+?)\.$/i,
      transform: (_, descriptor) => {
        parser.addOpponentPlayerPokemonStatus(PokemonStatus.CannotEvolve(), descriptor);
      },
    },
    {
      pattern: /^they can’t take any Energy from their Energy Zone to attach to their (.+?)\./i,
      transform: (_, descriptor) => {
        parser.addOpponentPlayerPokemonStatus(
          PokemonStatus.CannotAttachFromEnergyZone(),
          descriptor,
        );
      },
    },
    {
      pattern: /^Your opponent’s (.+?) takes \+(\d+) damage from being Poisoned\./i,
      transform: (_, descriptor, amount) => {
        parser.addOpponentPlayerPokemonStatus(
          PokemonStatus.IncreasePoisonDamage(+amount),
          descriptor,
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
      pattern: /^Discard all Pokémon Tools from your opponent’s Active Pokémon\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await game.discardPokemonTools(self.opponent.activeOrThrow());
        });
      },
    },
    {
      pattern:
        /^Change the type of the next Energy that will be generated for your opponent to 1 of the following at random: ([^.]+?)\./i,
      transform: (_, energyTypes) => {
        const possibleEnergies = parseEnergies(energyTypes);
        parser.addSideEffect(async (game, self) => {
          self.opponent.changeNextEnergy(randomElement(possibleEnergies));
        });
      },
    },

    // Miscellaneous
    {
      pattern:
        /^Choose 1 of your opponent’s( Active)? Pokémon’s attacks and use it as this attack\.( If this Pokémon doesn’t have the necessary Energy to use that attack, this attack does nothing\.)?/i,
      transform: (_, active, energyRequired) => {
        parser.addSideEffect(Effects.chooseAttackToCopy(!!active, !!energyRequired));
      },
    },
    {
      pattern: /^put it into your hand instead of the discard pile\./i,
      transform: () => {
        parser.addSideEffect(async (game, self) => {
          await self.player.returnPokemonToHand(self);
        });
      },
    },

    // Targeting
    {
      pattern: /^Choose 1 of your (?!opponent)(.+?)(?:, and|\.)/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
        effect.validTargets = (player) => player.InPlayPokemon.filter(predicate);
      },
    },

    // Explicit conditions
    {
      pattern: /^You can use this attack only if you have Uxie and Azelf on your Bench\./i,
      transform: () => {
        effect.explicitConditions.push((player) =>
          ["Uxie", "Azelf"].every((name) => player.BenchedPokemon.some((p) => p.Name == name)),
        );
      },
    },
    {
      pattern: /(?:You can use this card only)? ?if you have (.+?) in play[.,]/i,
      transform: (_, descriptor) => {
        const predicate = parser.parsePokemonPredicate(descriptor);
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
        parser.addSideEffect(async (game, self) => {
          const player = self.player;
          const prompt = "Choose a card to discard.";
          const cardToDiscard = await game.chooseCard(player, player.Hand, prompt);
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
        effect.explicitConditions.push((player, self) => self.hasAnyEnergy());
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

    parser.parseSuccessful = false;
    break;
  }

  if (parser.conditionalForNextEffect) {
    if (parser.hasAnyStatuses()) {
      effect.statusConditional = parser.conditionalForNextEffect;
    } else {
      console.warn("Unused conditional:", effect);
      parser.parseSuccessful = false;
    }
  }

  // For debugging effect text that should theoretically be parsing but isn't
  //if (text) console.warn(`Unparsed effect text: "${text}"`);

  return { parseSuccessful: parser.parseSuccessful, value: effect };
};
