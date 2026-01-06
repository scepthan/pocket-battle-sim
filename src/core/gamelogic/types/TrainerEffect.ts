import type { CoinFlipIndicator, Game, InPlayPokemon, Player, SideEffect } from "..";

export type TargetedEffect = (game: Game, target: InPlayPokemon) => Promise<void>;
interface BaseTrainerEffect {
  conditions: ((player: Player, self: InPlayPokemon) => boolean)[];
  coinsToFlip?: CoinFlipIndicator;
  sideEffects: SideEffect[];
}
interface StandardTrainerEffect extends BaseTrainerEffect {
  type: "Standard";
}
interface TargetedTrainerEffect extends BaseTrainerEffect {
  type: "Targeted";
  validTargets: (player: Player) => InPlayPokemon[];
}

export type TrainerEffect = StandardTrainerEffect | TargetedTrainerEffect;
