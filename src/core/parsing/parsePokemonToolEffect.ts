import {
  Game,
  InPlayPokemon,
  parseEnergy,
  type PokemonStatus,
  type PokemonToolEffect,
} from "../gamelogic";
import type { ParsedResult } from "./types";

interface EffectTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}
export const parsePokemonToolEffect = (cardText: string): ParsedResult<PokemonToolEffect> => {
  const effect: PokemonToolEffect = {
    trigger: "OnAttach",
    conditions: [],
    effect: async (game: Game) => {
      game.GameLog.notImplemented(game.AttackingPlayer);
    },
  };
  let effectText = cardText;
  let parseSuccessful = true;

  const dictionary: EffectTransformer[] = [
    {
      pattern:
        /^If the(?: {(\w)})? Pokémon this card is attached to is (?:in the Active Spot|your Active Pokémon) and is damaged by an attack from your opponent’s Pokémon, /i,
      transform: (_, energyType) => {
        effect.trigger = "OnAttackDamage";
        effect.conditions.push((pokemon) => pokemon === pokemon.player.ActivePokemon);
        if (energyType) {
          const fullType = parseEnergy(energyType);
          effect.conditions.push((pokemon) => pokemon.Type === fullType);
        }
      },
    },
    {
      pattern: /^At the end of each turn, /i,
      transform: () => {
        effect.trigger = "OnTurnEnd";
      },
    },

    {
      pattern: /^do (\d+) damage to the Attacking Pokémon\./i,
      transform: (_, damage) => {
        effect.effect = async (game) => {
          if (game.AttackingPokemon) game.applyDamage(game.AttackingPokemon, Number(damage), false);
        };
      },
    },
    {
      pattern: /^the Attacking Pokémon is now Poisoned\./i,
      transform: () => {
        effect.effect = async (game) => {
          if (game.AttackingPokemon) game.AttackingPokemon.player.poisonActivePokemon();
        };
      },
    },

    {
      pattern: /^The(?: {(\w)})? Pokémon this card is attached to gets \+(\d+) HP\./i,
      transform: (_, energyType, hp) => {
        if (energyType) {
          const fullType = parseEnergy(energyType);
          effect.conditions.push((pokemon) => pokemon.Type === fullType);
        }
        const status: PokemonStatus = {
          type: "IncreaseMaxHP",
          amount: Number(hp),
          source: "PokemonTool",
        };
        effect.effect = async (game, pokemon) => {
          pokemon.applyPokemonStatus(status);
        };
        effect.undo = async (game, pokemon) => {
          removePokemonStatus(pokemon, status);
        };
      },
    },
    {
      pattern:
        /^if the Pokémon this card is attached to is affected by any Special Conditions, it recovers from all of them, and discard this card\./i,
      transform: () => {
        effect.conditions.push((pokemon) => pokemon.hasSpecialCondition());
        effect.effect = async (game, pokemon) => {
          pokemon.removeAllSpecialConditions();

          const thisCard = pokemon.AttachedToolCards.find((card) => card.Text === cardText);
          if (!thisCard) throw new Error("Could not find this Pokemon Tool card");

          await game.discardPokemonTools(pokemon, [thisCard]);
        };
      },
    },
  ];

  mainloop: while (effectText) {
    for (const { pattern, transform } of dictionary) {
      const result = effectText.match(pattern);
      if (result) {
        transform(...result);
        effectText = effectText.replace(pattern, "").trim();
        continue mainloop; // Restart the loop to re-evaluate the modified ability text
      }
    }

    parseSuccessful = false;
    break;
  }

  return {
    parseSuccessful,
    value: effect,
  };
};

const removePokemonStatus = (pokemon: InPlayPokemon, status: PokemonStatus) => {
  const foundStatus = pokemon.PokemonStatuses.find(
    (s) => s.type === status.type && s.source === status.source
  );
  if (!foundStatus) throw new Error("Could not find status to remove");
  pokemon.logger.removePokemonStatus(pokemon, status);
  pokemon.removePokemonStatus(foundStatus);
};
