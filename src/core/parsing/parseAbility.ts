import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import {
  parseEnergy,
  type Ability,
  type PokemonConditional,
  type StatusAbilityEffect,
} from "../gamelogic";
import {
  parsePokemonPredicate as _pokemonParse,
  type InPlayPokemonPredicate,
} from "./parsePredicates";
import type { InputCardAbility, ParsedResult } from "./types";

interface AbilityTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}

const selfActive: PokemonConditional = (self) => self.player.ActivePokemon == self;
const selfBenched: PokemonConditional = (self) => self.player.BenchedPokemon.includes(self);

export const parseAbility = (inputAbility: InputCardAbility): ParsedResult<Ability> => {
  let ability: Ability = {
    type: "Standard",
    name: inputAbility.name,
    trigger: { type: "OnEnterPlay" },
    conditions: [],
    text: inputAbility.text,
    effect: {
      type: "Standard",
      effect: async (game) => {
        game.GameLog.notImplemented(game.AttackingPlayer);
      },
    },
  };
  const convertToStatusAbility = (effect: StatusAbilityEffect) => {
    const currentAbility = ability;

    const doesNotStack = effect.type === "PlayerStatus" && effect.status.doesNotStack;
    effect.status.id = doesNotStack ? uuidv5(currentAbility.name, uuidv5.URL) : uuidv4();

    ability = {
      type: "Status",
      name: currentAbility.name,
      text: currentAbility.text,
      conditions: currentAbility.conditions,
      effect,
    };
  };

  let abilityText = inputAbility.text;
  let parseSuccessful = true;

  const parsePokemonPredicate = (descriptor: string, initial?: InPlayPokemonPredicate) => {
    const { parseSuccessful: success, value } = _pokemonParse(descriptor, initial);
    if (!success) parseSuccessful = false;
    return value;
  };

  const dictionary: AbilityTransformer[] = [
    // Conditions
    {
      pattern: /(If|^As long as) this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /(If|^As long as) this Pokémon is on your Bench, /i,
      transform: () => {
        ability.conditions.push(selfBenched);
      },
    },
    {
      pattern: /^If this Pokémon has any Energy attached, /i,
      transform: () => {
        ability.conditions.push((self) => self.AttachedEnergy.length > 0);
      },
    },
    {
      pattern: /If you have (.+?) in play, /i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        ability.conditions.push((self) => self.player.InPlayPokemon.some(predicate));
      },
    },
    {
      pattern: /^During your first turn, /i,
      transform: () => {
        ability.conditions.push((self) => {
          const game = self.player.game;
          const turnNumber = game.TurnNumber;
          return self.player === game.AttackingPlayer && 1 <= turnNumber && turnNumber <= 2;
        });
      },
    },

    // Pokemon statuses
    {
      pattern: /^This Pokémon takes −(\d+) damage from attacks(?: from ([^.]+?))?\.$/i,
      transform: (_, amount, descriptor) => {
        const reduceAmount = Number(amount);
        const attackerCondition = descriptor
          ? {
              test: parsePokemonPredicate(descriptor),
              descriptor,
            }
          : undefined;

        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "ModifyIncomingAttackDamage",
            amount: -reduceAmount,
            source: "Ability",
            attackerCondition,
          },
        });
      },
    },
    {
      pattern:
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, this Pokémon takes −(\d+) damage from that attack\.$/i,
      transform: (_, amount) => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "ModifyIncomingAttackDamageOnCoinFlip",
            amount: -Number(amount),
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^Prevent all damage done to this Pokémon by attacks from your opponent’s (.+?)\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "PreventAttackDamage",
            source: "Ability",
            attackerCondition: {
              test: predicate,
              descriptor,
            },
          },
        });
      },
    },
    {
      pattern:
        /^Prevent all effects of attacks used by your opponent’s Pokémon done to this Pokémon\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "PreventAttackEffects",
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^This Pokémon can’t be affected by any Special Conditions\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "PreventSpecialConditions",
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^(it|this Pokémon) has no Retreat Cost\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "NoRetreatCost",
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^attacks used by this Pokémon cost (\d+) less {(\w)} Energy\./i,
      transform: (_, amount, energyType) => {
        const fullType = parseEnergy(energyType);

        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "ModifyAttackCost",
            energyType: fullType,
            amount: -Number(amount),
            source: "Ability",
          },
        });
      },
    },

    // Opponent player statuses
    {
      pattern: /^your opponent can’t use any Supporter cards from their hand\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: true,
          status: {
            type: "CannotUseSupporter",
            source: "Ability",
          },
        });
      },
    },
    {
      pattern:
        /^Your opponent can’t play any Pokémon from their hand to evolve their Active Pokémon\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: true,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: (p) => p === p.player.ActivePokemon,
              descriptor: "Active Pokémon",
            },
            pokemonStatus: { type: "CannotEvolve", source: "PlayerStatus" },
          },
        });
      },
    },

    // Self player statuses
    {
      pattern:
        /^Attacks used by your (.+?) do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, descriptor, amount) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            pokemonStatus: {
              type: "IncreaseAttack",
              amount: Number(amount),
              source: "PlayerStatus",
            },
          },
        });
      },
    },
    {
      pattern:
        /^attacks used by this Pokémon do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, amount) => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "IncreaseAttack",
            amount: Number(amount),
            source: "PlayerStatus",
          },
        });
      },
    },
    {
      pattern: /^your (Active .+?)’s Retreat Cost is (\d+) less\./i,
      transform: (_, descriptor, amount) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            pokemonStatus: {
              type: "ModifyRetreatCost",
              amount: -Number(amount),
              source: "PlayerStatus",
            },
          },
        });
      },
    },
    {
      pattern: /^your (Active .+?) has no Retreat Cost\./i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            pokemonStatus: { type: "NoRetreatCost", source: "PlayerStatus" },
          },
        });
      },
    },
    {
      pattern:
        /^Each of your (.+?) recovers from all Special Conditions and can’t be affected by any Special Conditions\.$/i,
      transform: (_, descriptor) => {
        const predicate = parsePokemonPredicate(descriptor);
        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            pokemonStatus: { type: "PreventSpecialConditions", source: "PlayerStatus" },
          },
        });
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your (.+?) provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType, descriptor) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(descriptor);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            type: "PokemonStatus",
            source: "Ability",
            pokemonCondition: {
              test: predicate,
              descriptor,
            },
            doesNotStack: true,
            pokemonStatus: {
              type: "DoubleEnergy",
              energyType: fullType,
              source: "PlayerStatus",
            },
          },
        });
      },
    },
  ];

  mainloop: while (abilityText) {
    for (const { pattern, transform } of dictionary) {
      const result = abilityText.match(pattern);
      if (result) {
        transform(...result);
        abilityText = abilityText.replace(pattern, "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified ability text
      }
    }

    parseSuccessful = false;
    break;
  }

  return {
    parseSuccessful,
    value: ability,
  };
};
