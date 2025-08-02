import type { Game, InPlayPokemonCard } from "../gamelogic";
import { parseEnergy, type Ability } from "../types";
import type { InputCardAbility, ParsedResult } from "./types";

interface AbilityTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}

export const parseAbility = (inputAbility: InputCardAbility): ParsedResult<Ability> => {
  const ability: Ability = {
    Name: inputAbility.Name,
    Trigger: "GameRule",
    Conditions: [],
    Effect: async (game: Game) => {
      game.GameLog.addEntry({
        type: "actionFailed",
        player: game.AttackingPlayer.Name,
        reason: "notImplemented",
      });
    },
  };
  let abilityText = inputAbility.Effect;
  let parseSuccessful = true;
  const dictionary: AbilityTransformer[] = [
    {
      pattern: /^Once during your turn, you may /i,
      transform: () => {
        ability.Trigger = "OnceDuringTurn";
      },
    },

    {
      pattern: /^take a {(\w)} Energy from your Energy Zone and attach it to this Pokémon\.$/i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);

        ability.Effect = async (game: Game, pokemon?: InPlayPokemonCard) => {
          game.AttackingPlayer.attachEnergy(pokemon!, [fullType], "energyZone");
        };
      },
    },
    {
      pattern:
        /take 1 {(\w)} Energy from your Energy Zone and attach it to the {(\w)} Pokémon in the Active Spot\./i,
      transform: (_, energyType, pokemonType) => {
        const fullType = parseEnergy(energyType);
        const pt = parseEnergy(pokemonType);

        ability.Effect = async (game: Game) => {
          const pokemon = game.AttackingPlayer.ActivePokemon!;
          if (pokemon.Type != pt) {
            game.GameLog.addEntry({
              type: "actionFailed",
              player: game.AttackingPlayer.Name,
              reason: "noValidTargets",
            });
            return;
          }
          game.AttackingPlayer.attachEnergy(pokemon, [fullType], "energyZone");
        };
      },
    },
    {
      pattern: /heal (\d+) damage from each of your Pokémon\.$/i,
      transform: (_, healing) => {
        ability.Effect = async (game: Game) => {
          for (const pokemon of game.AttackingPlayer.InPlayPokemon) {
            if (pokemon.CurrentHP < pokemon.BaseHP) {
              game.healPokemon(pokemon, Number(healing));
            }
          }
        };
      },
    },
    {
      pattern: /do (\d+) damage to 1 of your opponent's Pokémon\.$/i,
      transform: (_, damage) => {
        ability.Effect = async (game: Game) => {
          const pokemon = await game.choosePokemon(
            game.AttackingPlayer,
            game.DefendingPlayer.InPlayPokemon
          );
          if (pokemon) {
            game.applyDamage(pokemon, Number(damage), false);
          } else {
            game.GameLog.addEntry({
              type: "actionFailed",
              player: game.AttackingPlayer.Name,
              reason: "noValidTargets",
            });
          }
        };
      },
    },
    {
      pattern: /^flip a coin\. If heads, your opponent's Active Pokémon is now Asleep\.$/i,
      transform: () => {
        ability.Effect = async (game: Game) => {
          if (game.AttackingPlayer.flipCoin()) {
            game.DefendingPlayer.sleepActivePokemon();
          }
        };
      },
    },
    {
      pattern:
        /^switch out your opponent's Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)$/i,
      transform: () => {
        ability.Effect = async (game: Game) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        };
      },
    },
    {
      pattern: /^look at the top card of your deck\.$/i,
      transform: () => {
        ability.Effect = async (game: Game) => {
          await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
        };
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
