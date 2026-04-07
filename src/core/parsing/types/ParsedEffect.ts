import type {
  AbilityTrigger,
  Attack,
  CoinFlipIndicator,
  DamageCalculation,
  InPlayPokemon,
  Player,
  PlayerPokemonConditional,
  PlayerStatus,
  PokemonStatus,
  SideEffect,
} from "@/core/gamelogic";

/**
 * A unified structure for parsing effects of Attacks, Abilities, and Trainers.
 */
export interface ParsedEffect {
  /**
   * Determines a number to pass in to the effect. For coin flip effects, this is the number of
   * coins to flip. For other effects, it can be a calculation of how many Energy are attached to a
   * given Pokémon, how many Pokémon are on the player's Bench, or any other relevant number.
   *
   * There are 3 options:
   * 1. A hardcoded number.
   * 2. A method that calculates a number based on the game state.
   * 3. (Coin flip only) "UntilTails", which flips a coin until it lands on tails.
   *
   * The flip happens before any damage is dealt for Attack types of "CoinFlipForDamage",
   * "CoinFlipForAddedDamage", or "CoinFlipOrDoNothing", and after for "NoBaseDamage" or
   * "PredeterminableDamage".
   *
   * If using a method, it should not have any side effects, as it may be used to check whether an
   * effect can be used before actually using it.
   */
  passedAmount?: CoinFlipIndicator;

  /**
   * Indicates to flip coins for this Attack. This is used for "PredeterminableDamage" or
   * "NoBaseDamage" Attacks that still require coin flips. The number of coins to flip is
   * determined by the passedAmount property.
   */
  flipCoins?: boolean;

  /**
   * Different Attacks use coin flip results in different ways; this indicates how the results
   * should be used. If the Attack doesn't do damage, its type will be "NoBaseDamage"; if damage
   * isn't affected by any coin flips, its type will be "PredeterminableDamage".
   */
  attackType: Attack["type"];

  /**
   * A method that calculates the base damage of the Attack to be applied to the Defending Pokémon.
   * This method should not have any side effects, as it can be used for display purposes without
   * actually using the Attack.
   */
  calculateDamage?: DamageCalculation;

  /**
   * A method that determines which Pokémon the player can choose to target for any side effects,
   * such as dealing Bench damage to the opponent or healing an own Pokémon.
   */
  validTargets?: (player: Player, self?: InPlayPokemon) => InPlayPokemon[];

  /**
   * Effects to apply when Attacking before any damage is done.
   */
  preDamageEffects: SideEffect[];

  /**
   * Damage-dealing effects of an Attack other than dealing base damage to the Defending Pokémon.
   */
  attackingEffects: SideEffect[];

  /**
   * Non-damage-dealing effects of an Attack; all effects of a Trainer or Ability.
   */
  sideEffects: SideEffect[];

  /**
   * Extraneous conditions that must be met for the effect to be used (other than the default
   * Energy and status condition requirements for Attacks).
   */
  explicitConditions: PlayerPokemonConditional[];

  /**
   * Conditions that must be met for a Trainer or Ability with this effect to be used--for instance,
   * Professor's Research cannot be used if there are no cards in the deck.
   */
  implicitConditions: PlayerPokemonConditional[];

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
   * Leftover conditional for Attacks that apply statuses.
   */
  statusConditional?: PlayerPokemonConditional;
}
