import type { CoinFlipIndicator, Game, InPlayPokemon, SideEffect } from "..";

export type TargetedEffect = (game: Game, target: InPlayPokemon) => Promise<void>;
interface BaseTrainerEffect {
  conditions: ((game: Game, self: InPlayPokemon) => boolean)[];
  coinsToFlip?: CoinFlipIndicator;
  sideEffects: SideEffect[];
}
interface ConditionalTrainerEffect extends BaseTrainerEffect {
  type: "Conditional";
}
interface TargetedTrainerEffect extends BaseTrainerEffect {
  type: "Targeted";
  validTargets: (game: Game) => InPlayPokemon[];
}

export type TrainerEffect = ConditionalTrainerEffect | TargetedTrainerEffect;
