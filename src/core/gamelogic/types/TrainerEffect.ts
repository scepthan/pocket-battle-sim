import type {
  CoinFlipIndicator,
  Game,
  InPlayPokemon,
  Player,
  PlayerPokemonConditional,
  SideEffect,
} from "..";

export type TargetedEffect = (game: Game, target: InPlayPokemon) => Promise<void>;
interface BaseTrainerEffect {
  conditions: PlayerPokemonConditional[];
  passedAmount?: CoinFlipIndicator;
  flipCoins?: boolean;
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
