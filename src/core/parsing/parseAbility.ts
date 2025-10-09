import {
  parseEnergy,
  type Ability,
  type CardSlot,
  type Game,
  type InPlayPokemonCard,
  type PokemonCondition,
  type StatusAbilityEffect,
} from "../gamelogic";
import { parsePokemonPredicate } from "./parsePredicates";
import type { InputCardAbility, ParsedResult } from "./types";

interface AbilityTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}

const selfActive: PokemonCondition = (self) => self.player.ActivePokemon == self;

export const parseAbility = (inputAbility: InputCardAbility): ParsedResult<Ability> => {
  let ability: Ability = {
    type: "Standard",
    name: inputAbility.name,
    trigger: { type: "OnEnterPlay" },
    conditions: [],
    text: inputAbility.text,
    effect: {
      type: "Standard",
      effect: async (game: Game) => {
        game.GameLog.notImplemented(game.AttackingPlayer);
      },
    },
  };
  const convertToStatusAbility = (effect: StatusAbilityEffect) => {
    const currentAbility = ability;
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
  const dictionary: AbilityTransformer[] = [
    {
      pattern: /^Once during your turn, you may /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "Manual", multiUse: false };
      },
    },
    {
      pattern: /^If this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^Once during your turn, if this Pokémon is in the Active Spot, you may /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "Manual", multiUse: false };
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^As often as you like during your turn, you may /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "Manual", multiUse: true };
      },
    },
    {
      pattern:
        /^If this Pokémon is in the Active Spot and is damaged by an attack from your opponent’s Pokémon, /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "AfterDamagedByAttack" };
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^As long as this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^If this Pokémon has any Energy attached, /i,
      transform: () => {
        ability.conditions.push((self) => self.AttachedEnergy.length > 0);
      },
    },
    {
      pattern: /^Whenever you attach a \{(\w)\} Energy from your Energy Zone to this Pokémon, /i,
      transform: (_, energyType) => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        const fullType = parseEnergy(energyType);
        ability.trigger = { type: "OnEnergyZoneAttach", energy: fullType };
      },
    },

    {
      pattern: /^take a {(\w)} Energy from your Energy Zone and attach it to this Pokémon\.$/i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);
        ability.effect = {
          type: "Standard",
          effect: async (game: Game, pokemon?: InPlayPokemonCard) => {
            await game.AttackingPlayer.attachEnergy(pokemon!, [fullType], "energyZone");
          },
        };
      },
    },
    {
      pattern: /move a {(\w)} Energy from 1 of your Benched (.+?) to your Active (.+?)\./i,
      transform: (_, energyType, benchedSpecifier, activeSpecifier) => {
        const fullType = parseEnergy(energyType);
        const benchPredicate = parsePokemonPredicate(benchedSpecifier, (p) =>
          p.AttachedEnergy.includes(fullType)
        );
        const activePredicate = parsePokemonPredicate(activeSpecifier);
        ability.conditions.push((self) => activePredicate(self.player.activeOrThrow()));

        ability.effect = {
          type: "Targeted",
          findValidTargets: (game: Game, self: InPlayPokemonCard) =>
            self.player.BenchedPokemon.filter(benchPredicate),
          effect: async (game: Game, self: InPlayPokemonCard, target: CardSlot) => {
            if (!target.isPokemon) throw new Error("Not a valid target");
            const active = game.AttackingPlayer.activeOrThrow();

            await game.AttackingPlayer.transferEnergy(target, active, [fullType]);
          },
        };
      },
    },
    {
      pattern:
        /take a {(\w)} Energy from your Energy Zone and attach it to the {(\w)} Pokémon in the Active Spot\./i,
      transform: (_, energyType, pokemonType) => {
        const fullType = parseEnergy(energyType);
        const pt = parseEnergy(pokemonType);

        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            const pokemon = game.AttackingPlayer.activeOrThrow();
            if (pokemon.Type != pt) {
              game.GameLog.noValidTargets(game.AttackingPlayer);
              return;
            }
            await game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
          },
        };
      },
    },
    {
      pattern: /heal (\d+) damage from each of your Pokémon\.$/i,
      transform: (_, healing) => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            for (const pokemon of game.AttackingPlayer.InPlayPokemon) {
              if (pokemon.isDamaged()) {
                game.healPokemon(pokemon, Number(healing));
              }
            }
          },
        };
      },
    },
    {
      pattern: /do (\d+) damage to the Attacking Pokémon\.$/i,
      transform: (_, damage) => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            game.applyDamage(game.AttackingPlayer.activeOrThrow(), Number(damage), false);
          },
        };
      },
    },
    {
      pattern: /do (\d+) damage to 1 of your opponent’s Pokémon\.$/i,
      transform: (_, damage) => {
        ability.effect = {
          type: "Targeted",
          findValidTargets: (game, self) => self.player.opponent.InPlayPokemon,
          effect: async (game, self, target) => {
            if (!target.isPokemon) return;
            game.applyDamage(target, Number(damage), false);
          },
        };
      },
    },
    {
      pattern: /^flip a coin\. If heads, your opponent’s Active Pokémon is now Asleep\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            if (game.AttackingPlayer.flipCoin()) {
              game.DefendingPlayer.sleepActivePokemon();
            }
          },
        };
      },
    },
    {
      pattern:
        /^switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
          },
        };
      },
    },
    {
      pattern: /^look at the top card of your deck\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
          },
        };
      },
    },
    {
      pattern: /^make your opponent’s Active Pokémon Poisoned\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game) => {
            game.DefendingPlayer.poisonActivePokemon();
          },
        };
      },
    },
    {
      pattern: /^switch in 1 of your opponent’s Benched Basic Pokémon to the Active Spot\.$/i,
      transform: () => {
        ability.effect = {
          type: "Targeted",
          findValidTargets: (game, self) =>
            self.player.opponent.BenchedPokemon.filter((p) => p.Stage === 0),
          effect: async (game, self, target) => {
            if (!target.isPokemon) throw new Error("Not a valid target");
            await self.player.opponent.swapActivePokemon(
              target,
              "opponentEffect",
              game.AttackingPlayer.Name
            );
          },
        };
      },
    },
    {
      pattern:
        /^choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon\.$/i,
      transform: () => {
        ability.effect = {
          type: "Targeted",
          findValidTargets: (game, self) =>
            self.player.InPlayPokemon.filter((p) => p.isDamaged() && p !== self),
          effect: async (game, self, target) => {
            if (!target.isPokemon) throw new Error("Not a valid target");
            const damage = target.currentDamage();
            game.applyDamage(self, damage, false);
            game.healPokemon(target, damage);
          },
        };
      },
    },

    // Pokemon statuses
    {
      pattern: /^This Pokémon takes −(\d+) damage from attacks(?: from ([^.]+?))?\.$/i,
      transform: (_, amount, specifier) => {
        const reduceAmount = Number(amount);
        const attackerCondition = specifier
          ? {
              test: parsePokemonPredicate(specifier),
              descriptor: specifier,
            }
          : undefined;

        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "ReduceAttackDamage",
            amount: reduceAmount,
            source: "Ability",
            attackerCondition,
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
      pattern: /^it has no Retreat Cost\.$/i,
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

    // Opponent player statuses
    {
      pattern: /^your opponent can’t use any Supporter cards from their hand\.$/i,
      transform: () => {
        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: true,
          status: {
            category: "GameRule",
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
            category: "Pokemon",
            type: "CannotEvolve",
            source: "Ability",
            appliesToPokemon: (p) => p === p.player.ActivePokemon,
            descriptor: "Active Pokémon",
          },
        });
      },
    },

    // Self player statuses
    {
      pattern:
        /^Attacks used by your (.+?) do \+(\d+) damage to your opponent’s Active Pokémon\.$/i,
      transform: (_, specifier, amount) => {
        const predicate = parsePokemonPredicate(specifier);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            category: "Pokemon",
            type: "IncreaseAttack",
            amount: Number(amount),
            source: "Ability",
            appliesToPokemon: predicate,
            descriptor: "Active Pokémon",
          },
        });
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your {\1} Pokémon provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            category: "Pokemon",
            type: "DoubleEnergy",
            energyType: fullType,
            source: "Ability",
            appliesToPokemon: (p) => p.Type === fullType,
            doesNotStack: true,
            descriptor: fullType + "-type Pokémon",
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
