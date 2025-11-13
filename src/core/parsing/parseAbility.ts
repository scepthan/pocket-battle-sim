import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import {
  parseEnergy,
  type Ability,
  type PokemonConditional,
  type StatusAbilityEffect,
} from "../gamelogic";
import { parsePokemonPredicate } from "./parsePredicates";
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
  const dictionary: AbilityTransformer[] = [
    // Triggers
    {
      pattern: /^Once during your turn, you may /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "Manual", multiUse: false };
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
      pattern: /^Whenever you attach a \{(\w)\} Energy from your Energy Zone to this Pokémon, /i,
      transform: (_, energyType) => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        const fullType = parseEnergy(energyType);
        ability.trigger = { type: "OnEnergyZoneAttach", energy: fullType };
      },
    },
    {
      pattern: /^During Pokémon Checkup, /i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "OnPokemonCheckup" };
      },
    },

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
      transform: (_, specifier) => {
        const predicate = parsePokemonPredicate(specifier);
        ability.conditions.push((self) => self.player.InPlayPokemon.some(predicate));
      },
    },

    // Energy effects
    {
      pattern:
        /^take a {(\w)} Energy from your Energy Zone and attach it to this Pokémon\.( If you use this Ability, your turn ends\.)?$/i,
      transform: (_, energyType, endTurn) => {
        const fullType = parseEnergy(energyType);
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            await self.player.attachEnergy(self, [fullType], "energyZone");
            if (endTurn) game.endTurnResolve(true);
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

        ability.conditions.push((self) => self.player.activeOrThrow().Type === pt);
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            const pokemon = self.player.activeOrThrow();
            await self.player.attachEnergy(pokemon, [fullType], "energyZone");
          },
        };
      },
    },
    {
      pattern: /take a {(\w)} Energy from your Energy Zone and attach it to 1 of your ([^.]+?)\./i,
      transform: (_, energyType, specifier) => {
        const fullType = parseEnergy(energyType);
        const predicate = parsePokemonPredicate(specifier);

        ability.effect = {
          type: "Targeted",
          findValidTargets: (game, self) => self.player.InPlayPokemon.filter(predicate),
          effect: async (game, self, target) => {
            if (!target.isPokemon) throw new Error("Not a valid target");

            await self.player.attachEnergy(target, [fullType], "energyZone");
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
          findValidTargets: (game, self) => self.player.BenchedPokemon.filter(benchPredicate),
          effect: async (game, self, target) => {
            if (!target.isPokemon) throw new Error("Not a valid target");
            const active = self.player.activeOrThrow();

            await self.player.transferEnergy(target, active, [fullType]);
          },
        };
      },
    },

    // Healing effects
    {
      pattern: /heal (\d+) damage from each of your Pokémon\.$/i,
      transform: (_, healing) => {
        ability.conditions.push((self) => self.player.InPlayPokemon.some((p) => p.isDamaged()));
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            for (const pokemon of self.player.InPlayPokemon) {
              if (pokemon.isDamaged()) {
                game.healPokemon(pokemon, Number(healing));
              }
            }
          },
        };
      },
    },
    {
      pattern: /heal (\d+) damage from this Pokémon\.$/i,
      transform: (_, healing) => {
        ability.conditions.push((self) => self.isDamaged());
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            game.healPokemon(self, Number(healing));
          },
        };
      },
    },
    {
      pattern: /heal (\d+) damage from your Active Pokémon\.$/i,
      transform: (_, healing) => {
        ability.conditions.push((self) => self.player.activeOrThrow().isDamaged());
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            game.healPokemon(self.player.activeOrThrow(), Number(healing));
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

    // Damage effects
    {
      pattern: /do (\d+) damage to (?:the Attacking Pokémon|your opponent’s Active Pokémon)\.$/i,
      transform: (_, damage) => {
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            game.applyDamage(self.player.opponent.activeOrThrow(), Number(damage), false);
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

    // Special Condition effects
    {
      pattern: /^flip a coin\. If heads, your opponent’s Active Pokémon is now Asleep\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            if (self.player.flipCoin()) self.player.opponent.sleepActivePokemon();
          },
        };
      },
    },
    {
      pattern: /^flip a coin\. If heads, your opponent’s Active Pokémon is now Poisoned\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            if (self.player.flipCoin()) self.player.opponent.poisonActivePokemon();
          },
        };
      },
    },
    {
      pattern: /^make your opponent’s Active Pokémon Poisoned\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            self.player.opponent.poisonActivePokemon();
          },
        };
      },
    },
    {
      pattern:
        /^switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)$/i,
      transform: () => {
        ability.conditions.push((self) => self.player.opponent.BenchedPokemon.length > 0);
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            await game.swapActivePokemon(self.player.opponent, "opponentEffect");
          },
        };
      },
    },

    // Deck-related effects
    {
      pattern: /^look at the top card of your deck\.$/i,
      transform: () => {
        ability.conditions.push((self) => self.player.Deck.length > 0);
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            await game.showCards(self.player, self.player.Deck.slice(0, 1));
          },
        };
      },
    },
    {
      pattern: /choose either player\. Look at the top card of that player’s deck\./i,
      transform: () => {
        ability.conditions.push(
          (self) => self.player.Deck.length > 0 || self.player.opponent.Deck.length > 0
        );
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            const choice = await game.choose(self.player, ["Self", "Opponent"]);
            if (!choice) throw new Error("No player chosen");

            const chosenPlayer = choice === "Self" ? self.player : self.player.opponent;
            if (chosenPlayer.Deck.length > 0) {
              await game.showCards(self.player, chosenPlayer.Deck.slice(0, 1));
            }
          },
        };
      },
    },
    {
      pattern:
        /You must discard a card from your hand in order to use this Ability\. Once during your turn, you may draw a card\./i,
      transform: () => {
        if (ability.type === "Status") throw new Error("Cannot set trigger on Status Ability");
        ability.trigger = { type: "Manual", multiUse: false };
        ability.conditions.push((self) => self.player.Hand.length > 0);
        ability.effect = {
          type: "Standard",
          effect: async (game, self) => {
            const player = self.player;
            const cardToDiscard = await game.choose(player, player.Hand);
            if (!cardToDiscard) throw new Error("No card chosen to discard");
            player.discardCardsFromHand([cardToDiscard]);
            player.drawCards(1);
          },
        };
      },
    },

    // Other effects
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
        /^If any damage is done to this Pokémon by attacks, flip a coin\. If heads, this Pokémon takes −(\d+) damage from that attack\.$/i,
      transform: (_, amount) => {
        convertToStatusAbility({
          type: "PokemonStatus",
          status: {
            type: "ReduceAttackDamageOnCoinFlip",
            amount: Number(amount),
            source: "Ability",
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
            type: "ReduceAttackCost",
            energyType: fullType,
            amount: Number(amount),
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
            descriptor: specifier,
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
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^your (Active .+?)’s Retreat Cost is (\d+) less\./i,
      transform: (_, specifier, amount) => {
        const appliesToPokemon = parsePokemonPredicate(specifier);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            category: "Pokemon",
            type: "DecreaseRetreatCost",
            amount: Number(amount),
            appliesToPokemon,
            descriptor: specifier,
            source: "Ability",
          },
        });
      },
    },
    {
      pattern: /^your (Active .+?) has no Retreat Cost\./i,
      transform: (_, specifier) => {
        const appliesToPokemon = parsePokemonPredicate(specifier);

        convertToStatusAbility({
          type: "PlayerStatus",
          opponent: false,
          status: {
            category: "Pokemon",
            type: "NoRetreatCost",
            appliesToPokemon,
            descriptor: specifier,
            source: "Ability",
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
