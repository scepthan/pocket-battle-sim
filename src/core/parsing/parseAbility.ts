import {
  parseEnergy,
  type Ability,
  type Game,
  type InPlayPokemonCard,
  type PlayerStatus,
} from "../gamelogic";
import { removeElement } from "../util";
import type { InputCardAbility, ParsedResult } from "./types";

interface AbilityTransformer {
  pattern: RegExp;
  transform: (...args: string[]) => void;
}

export const parseAbility = (inputAbility: InputCardAbility): ParsedResult<Ability> => {
  const ability: Ability = {
    Name: inputAbility.Name,
    Trigger: "OnEnterPlay",
    Conditions: [],
    Text: inputAbility.Effect,
    Effect: async (game: Game) => {
      game.GameLog.notImplemented(game.AttackingPlayer);
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
      pattern: /^If this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.Conditions.push("Active");
      },
    },
    {
      pattern: /^Once during your turn, if this Pokémon is in the Active Spot, you may /i,
      transform: () => {
        ability.Trigger = "OnceDuringTurn";
        ability.Conditions.push("Active");
      },
    },
    {
      pattern: /^As often as you like during your turn, you may /i,
      transform: () => {
        ability.Trigger = "ManyDuringTurn";
      },
    },
    {
      pattern:
        /^If this Pokémon is in the Active Spot and is damaged by an attack from your opponent's Pokémon, /i,
      transform: () => {
        ability.Trigger = "AfterAttackDamage";
        ability.Conditions.push("Active");
      },
    },
    {
      pattern: /^As long as this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.Trigger = "OnEnterActive";
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
        /move a {(\w)} Energy from 1 of your Benched(?: {(\w)})? Pokémon to your Active(?: {(\w)})? Pokémon\./i,
      transform: (_, energyType, benchedType, activeType) => {
        const fullType = parseEnergy(energyType);
        const at = activeType && parseEnergy(activeType);
        const bt = benchedType && parseEnergy(benchedType);

        ability.Effect = async (game: Game) => {
          const active = game.AttackingPlayer.activeOrThrow();
          if (active.Type != at) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }

          const validBenched = game.AttackingPlayer.BenchedPokemon.filter(
            (p) => (bt ? p.Type === bt : true) && p.AttachedEnergy.includes(fullType)
          );
          if (!validBenched.length) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }

          const benched = await game.choosePokemon(game.AttackingPlayer, validBenched);
          if (!benched) return;

          game.AttackingPlayer.transferEnergy(benched, active, [fullType]);
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
          const pokemon = game.AttackingPlayer.activeOrThrow();
          if (pokemon.Type != pt) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
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
            if (pokemon.isDamaged()) {
              game.healPokemon(pokemon, Number(healing));
            }
          }
        };
      },
    },
    {
      pattern: /do (\d+) damage to the Attacking Pokémon\.$/i,
      transform: (_, damage) => {
        ability.Effect = async (game: Game) => {
          game.applyDamage(game.AttackingPlayer.activeOrThrow(), Number(damage), false);
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
            game.GameLog.noValidTargets(game.AttackingPlayer);
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
    {
      pattern: /^make your opponent's Active Pokémon Poisoned\.$/i,
      transform: () => {
        ability.Effect = async (game: Game) => {
          game.DefendingPlayer.poisonActivePokemon();
        };
      },
    },
    {
      pattern: /^switch in 1 of your opponent's Benched Basic Pokémon to the Active Spot\.$/i,
      transform: () => {
        ability.Effect = async (game: Game) => {
          const benchedBasics = game.DefendingPlayer.BenchedPokemon.filter((p) => p.Stage === 0);
          if (benchedBasics.length === 0) {
            game.GameLog.noValidTargets(game.AttackingPlayer);
            return;
          }
          const chosenPokemon = await game.choosePokemon(game.AttackingPlayer, benchedBasics);
          if (chosenPokemon) {
            await game.DefendingPlayer.swapActivePokemon(
              chosenPokemon,
              "opponentEffect",
              game.AttackingPlayer.Name
            );
          }
        };
      },
    },

    {
      pattern: /^This Pokémon takes -(\d+) damage from attacks\.$/i,
      transform: (_, amount) => {
        const reduceAmount = Number(amount);
        ability.Trigger = "OnEnterPlay";
        ability.Effect = async (game: Game, pokemon?: InPlayPokemonCard) => {
          if (!pokemon) return;
          game.applyPokemonStatus(pokemon, {
            type: "ReduceDamage",
            amount: reduceAmount,
            source: "Ability",
            condition: "none",
          });
        };
      },
    },
    {
      pattern: /^your opponent can't use any Supporter cards from their hand\.$/i,
      transform: () => {
        ability.Effect = async (game: Game, pokemon: InPlayPokemonCard) => {
          const opponent = game.findOwner(pokemon) == game.Player1 ? game.Player2 : game.Player1;
          const status: PlayerStatus = {
            category: "GameRule",
            type: "CannotUseSupporter",
            source: "Ability",
          };
          pokemon.ActivePlayerStatuses.push(status);
          opponent.applyStatus(status);
        };
        ability.UndoEffect = undoPlayerStatus("CannotUseSupporter", true);
      },
    },
    {
      pattern:
        /^Your opponent can't play any Pokémon from their hand to evolve their Active Pokémon\.$/i,
      transform: () => {
        ability.Effect = async (game: Game, pokemon: InPlayPokemonCard) => {
          const opponent = game.findOwner(pokemon) == game.Player1 ? game.Player2 : game.Player1;
          const status: PlayerStatus = {
            category: "Pokemon",
            type: "CannotEvolve",
            source: "Ability",
            appliesToPokemon: (p) => p === opponent.ActivePokemon,
            descriptor: "Active Pokémon",
          };
          pokemon.ActivePlayerStatuses.push(status);
          opponent.applyStatus(status);
        };
        ability.UndoEffect = undoPlayerStatus("CannotEvolve", true);
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

const undoPlayerStatus =
  (statusType: string, isOpponent: boolean) => async (game: Game, pokemon: InPlayPokemonCard) => {
    const status = pokemon.ActivePlayerStatuses.find((s) => s.type === statusType);
    if (!status) return;
    pokemon.ActivePlayerStatuses = pokemon.ActivePlayerStatuses.filter((s) => s !== status);

    const owner = game.findOwner(pokemon);
    const player = isOpponent ? (owner == game.Player1 ? game.Player2 : game.Player1) : owner;
    removeElement(player.PlayerStatuses, status);
  };
