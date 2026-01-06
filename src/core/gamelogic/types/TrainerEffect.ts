import type { Game, InPlayPokemon, Player } from "..";
import type { BasicEffect } from "./Effects";

export type TargetedEffect = (game: Game, target: InPlayPokemon) => Promise<void>;
export type ConditionalTrainerEffect = {
  type: "Conditional";
  condition: (game: Game, self: Player) => boolean;
  effect: BasicEffect;
};
export type TargetedTrainerEffect = {
  type: "Targeted";
  validTargets: (game: Game) => InPlayPokemon[];
  condition?: (game: Game, self: Player) => boolean;
  effect: TargetedEffect;
};
export type TrainerEffect = ConditionalTrainerEffect | TargetedTrainerEffect;
