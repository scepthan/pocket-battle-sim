import type { Game, InPlayPokemon, Player } from "..";
import type { Energy } from "./Energy";

export type CoinFlipIndicator =
  | number
  | "UntilTails"
  | ((game: Game, self: InPlayPokemon) => number);

export type SideEffect = (
  game: Game,
  self: InPlayPokemon,
  heads: number,
  target?: InPlayPokemon,
) => Promise<void>;

export type DamageCalculation = (game: Game, self: InPlayPokemon, heads: number) => number;

interface BaseAttack {
  // Properties inherited from InputAttack
  name: string;
  requiredEnergy: Energy[];
  text?: string;
  baseDamage?: number;
  damageSymbol?: "+" | "x";

  /**
   * Determines how many coins to flip for the attack effect. There are 3 options:
   * 1. A number, which flips that many coins.
   * 2. "UntilTails", which flips a coin until it lands on tails.
   * 3. A method that calculates how many coins to flip based on the game state.
   *
   * This flip happens before any damage is dealt for attack types of "CoinFlipForDamage",
   * "CoinFlipForAddedDamage", or "CoinFlipOrDoNothing", and after for "NoBaseDamage" or
   * "PredeterminableDamage".
   */
  coinsToFlip?: CoinFlipIndicator;

  /**
   * A method that calculates the base damage of the attack to be applied to the Defending Pokémon.
   * This method should not have any side effects.
   */
  calculateDamage?: DamageCalculation;

  /**
   * A method that determines which Pokémon the player can select whenever this applies, such as
   * for attacks that damage a specific Pokémon or generate Energy for the Bench.
   */
  validTargets?: (player: Player, self: InPlayPokemon) => InPlayPokemon[];

  /**
   * Effects to apply when attacking before any damage is done.
   */
  preDamageEffects: SideEffect[];

  /**
   * Damage-dealing effects of the attack other than dealing base damage to the Defending Pokémon.
   */
  attackingEffects: SideEffect[];

  /**
   * Non-damage-dealing effects of the attack.
   */
  sideEffects: SideEffect[];

  /**
   * Extraneous conditions that must be met for the attack to be used (other than the default
   * Energy and status condition requirements).
   */
  explicitConditions: ((player: Player, self: InPlayPokemon) => boolean)[];
}

// Flip a coin. If tails, this attack does nothing.
// Flip a coin. If tails, this attack does nothing. If heads, ___.
interface CoinFlipOrDoNothingAttack extends BaseAttack {
  type: "CoinFlipOrDoNothing";
}

// Flip N coins. This attack does X damage for each heads.
// Flip N coins. This attack does X damage for each heads. If at least K of them are heads, ___.
// Flip a coin until you get tails. This attack does X damage for each heads.
// Flip a coin for each ___. This attack does X damage for each heads.
interface CoinFlipForDamageAttack extends BaseAttack {
  type: "CoinFlipForDamage";
  coinsToFlip: CoinFlipIndicator;
  calculateDamage: DamageCalculation;
}

// Flip N coins. This attack does X more damage for each heads.
// Flip N coins. This attack does X more damage for each heads. If at least K of them are heads, ___. (Does not exist yet)
// Flip a coin until you get tails. This attack does X more damage for each heads.
// Flip a coin for each ___. This attack does X more damage for each heads. (Does not exist yet)
// Flip a coin. If heads, this attack does X more damage.
// Flip a coin. If heads, this attack does X more damage. If tails, ___.
// Flip 2 coins. If both of them are heads, this attack does X more damage.
interface CoinFlipForAddedDamageAttack extends BaseAttack {
  type: "CoinFlipForAddedDamage";
  coinsToFlip: CoinFlipIndicator;
  calculateDamage: DamageCalculation;
}

// Anything else with baseDamage goes here
interface PredeterminableDamageAttack extends BaseAttack {
  type: "PredeterminableDamage";
}

// Anything without baseDamage goes here
interface NoBaseDamageAttack extends BaseAttack {
  type: "NoBaseDamage";
}

export type Attack =
  | CoinFlipOrDoNothingAttack
  | CoinFlipForDamageAttack
  | CoinFlipForAddedDamageAttack
  | PredeterminableDamageAttack
  | NoBaseDamageAttack;
