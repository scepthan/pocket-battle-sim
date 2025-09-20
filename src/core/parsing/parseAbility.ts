import {
  parseEnergy,
  Player,
  type Ability,
  type AbilityCondition,
  type CardSlot,
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

const selfActive: AbilityCondition = (game: Game, self: InPlayPokemonCard) =>
  self.player.ActivePokemon == self;

export const parseAbility = (inputAbility: InputCardAbility): ParsedResult<Ability> => {
  const ability: Ability = {
    name: inputAbility.name,
    trigger: "OnEnterPlay",
    conditions: [],
    text: inputAbility.text,
    effect: {
      type: "Standard",
      effect: async (game: Game) => {
        game.GameLog.notImplemented(game.AttackingPlayer);
      },
    },
  } as Ability;
  let abilityText = inputAbility.text;
  let parseSuccessful = true;
  const dictionary: AbilityTransformer[] = [
    {
      pattern: /^Once during your turn, you may /i,
      transform: () => {
        ability.trigger = "OnceDuringTurn";
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
        ability.trigger = "OnceDuringTurn";
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^As often as you like during your turn, you may /i,
      transform: () => {
        ability.trigger = "ManyDuringTurn";
      },
    },
    {
      pattern:
        /^If this Pokémon is in the Active Spot and is damaged by an attack from your opponent’s Pokémon, /i,
      transform: () => {
        ability.trigger = "AfterAttackDamage";
        ability.conditions.push(selfActive);
      },
    },
    {
      pattern: /^As long as this Pokémon is in the Active Spot, /i,
      transform: () => {
        ability.trigger = "OnEnterActive";
      },
    },

    {
      pattern: /^take a {(\w)} Energy from your Energy Zone and attach it to this Pokémon\.$/i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);

        ability.effect.effect = async (game: Game, pokemon?: InPlayPokemonCard) => {
          game.AttackingPlayer.attachEnergy(pokemon!, [fullType], "energyZone");
        };
      },
    },
    {
      pattern:
        /move a {(\w)} Energy from 1 of your Benched(?: {(\w)})? Pokémon to your Active(?: {(\w)})? Pokémon\./i,
      transform: (_, energyType, benchedType, activeType) => {
        const fullType = parseEnergy(energyType);
        const bt = benchedType && parseEnergy(benchedType);
        const predicate = (pokemon: InPlayPokemonCard) =>
          (!bt || pokemon.Type == bt) && pokemon.AttachedEnergy.includes(fullType);
        if (activeType) {
          const at = parseEnergy(activeType);
          ability.conditions.push(
            (game: Game, self: InPlayPokemonCard) => self.player.activeOrThrow().Type === at
          );
        }

        ability.effect = {
          type: "Targeted",
          findValidTargets: (game: Game, self: InPlayPokemonCard) =>
            self.player.BenchedPokemon.filter(predicate),
          effect: async (game: Game, self: InPlayPokemonCard, target: CardSlot) => {
            if (!target.isPokemon) throw new Error("Not a valid target");
            const active = game.AttackingPlayer.activeOrThrow();

            game.AttackingPlayer.transferEnergy(target, active, [fullType]);
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

        ability.effect.effect = async (game: Game) => {
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
        ability.effect.effect = async (game: Game) => {
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
        ability.effect.effect = async (game: Game) => {
          game.applyDamage(game.AttackingPlayer.activeOrThrow(), Number(damage), false);
        };
      },
    },
    {
      pattern: /do (\d+) damage to 1 of your opponent’s Pokémon\.$/i,
      transform: (_, damage) => {
        ability.effect = {
          type: "Targeted",
          findValidTargets: (game, self) => self.player.opponent.BenchedPokemon,
          effect: async (game, self, target) => {
            if (target.isPokemon) {
              game.applyDamage(target, Number(damage), false);
            } else {
              throw new Error("No valid targets for Greninja");
            }
          },
        };
      },
    },
    {
      pattern: /^flip a coin\. If heads, your opponent’s Active Pokémon is now Asleep\.$/i,
      transform: () => {
        ability.effect.effect = async (game: Game) => {
          if (game.AttackingPlayer.flipCoin()) {
            game.DefendingPlayer.sleepActivePokemon();
          }
        };
      },
    },
    {
      pattern:
        /^switch out your opponent’s Active Pokémon to the Bench\. \(Your opponent chooses the new Active Pokémon\.\)$/i,
      transform: () => {
        ability.effect.effect = async (game: Game) => {
          await game.swapActivePokemon(game.DefendingPlayer, "opponentEffect");
        };
      },
    },
    {
      pattern: /^look at the top card of your deck\.$/i,
      transform: () => {
        ability.effect.effect = async (game: Game) => {
          await game.showCards(game.AttackingPlayer, game.AttackingPlayer.Deck.slice(0, 1));
        };
      },
    },
    {
      pattern: /^make your opponent’s Active Pokémon Poisoned\.$/i,
      transform: () => {
        ability.effect.effect = async (game: Game) => {
          game.DefendingPlayer.poisonActivePokemon();
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
      pattern: /^This Pokémon takes −(\d+) damage from attacks\.$/i,
      transform: (_, amount) => {
        const reduceAmount = Number(amount);
        ability.trigger = "OnEnterPlay";
        ability.effect.effect = async (game: Game, pokemon?: InPlayPokemonCard) => {
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
      pattern: /^your opponent can’t use any Supporter cards from their hand\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game, self: InPlayPokemonCard) => {
            const status: PlayerStatus = {
              category: "GameRule",
              type: "CannotUseSupporter",
              source: "Ability",
            };
            applyPlayerStatus(self.player.opponent, status, self.player, self);
          },
          undo: undoPlayerStatus("CannotUseSupporter", true),
        };
      },
    },
    {
      pattern:
        /^Your opponent can’t play any Pokémon from their hand to evolve their Active Pokémon\.$/i,
      transform: () => {
        ability.effect = {
          type: "Standard",
          effect: async (game: Game, self: InPlayPokemonCard) => {
            const status: PlayerStatus = {
              category: "Pokemon",
              type: "CannotEvolve",
              source: "Ability",
              appliesToPokemon: (p) => p === self.player.opponent.ActivePokemon,
              descriptor: "Active Pokémon",
            };
            applyPlayerStatus(self.player.opponent, status, self.player, self);
          },
          undo: undoPlayerStatus("CannotUseSupporter", true),
        };
      },
    },
    {
      pattern:
        /^Each {(\w)} Energy attached to your {\1} Pokémon provides 2 {\1} Energy. This effect doesn’t stack.$/i,
      transform: (_, energyType) => {
        const fullType = parseEnergy(energyType);

        ability.effect = {
          type: "Standard",
          effect: async (game: Game, self: InPlayPokemonCard) => {
            const status: PlayerStatus = {
              category: "Pokemon",
              type: "DoubleEnergy",
              energyType: fullType,
              source: "Ability",
              appliesToPokemon: (p) => p.Type === fullType,
              doesNotStack: true,
              descriptor: fullType + "-type Pokémon",
            };
            applyPlayerStatus(self.player, status, self.player, self);
          },
          undo: undoPlayerStatus("CannotUseSupporter", true),
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

const applyPlayerStatus = (
  player: Player,
  status: PlayerStatus,
  owner: Player,
  pokemon: InPlayPokemonCard
) => {
  if (status.doesNotStack && owner.PlayerStatuses.some((s) => s.type === status.type)) {
    let activeStatus: PlayerStatus | undefined;
    for (const p of owner.InPlayPokemon) {
      if (p !== pokemon && p.Name === pokemon.Name) {
        activeStatus = p.ActivePlayerStatuses.find((s) => s.type === status.type);
        if (activeStatus) {
          status = activeStatus;
          break;
        }
      }
    }
  }

  player.applyStatus(status);
  pokemon.ActivePlayerStatuses.push(status);
};
const undoPlayerStatus =
  (statusType: string, isOpponent: boolean) => async (game: Game, pokemon: InPlayPokemonCard) => {
    const status = pokemon.ActivePlayerStatuses.find((s) => s.type === statusType);
    if (!status) return;
    pokemon.ActivePlayerStatuses = pokemon.ActivePlayerStatuses.filter((s) => s !== status);

    const owner = pokemon.player;

    if (
      status.doesNotStack &&
      owner.InPlayPokemon.some((p) => p !== pokemon && p.ActivePlayerStatuses.includes(status))
    ) {
      // Another instance of this status is still active on another Pokémon, so do not remove it from the player
      return;
    }

    const player = isOpponent ? owner.opponent : owner;
    removeElement(player.PlayerStatuses, status);
  };
