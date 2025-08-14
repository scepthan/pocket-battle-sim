import type { Game, Player } from "..";
import type { BasicEffect } from "./BasicEffect";
import type { CardSlot } from "./CardSlot";

export type TargetedEffect<T> = (game: Game, target: T) => Promise<void>;
export type ConditionalTrainerEffect = {
  type: "Conditional";
  condition: (game: Game, self: Player) => boolean;
  effect: BasicEffect;
};
export type TargetedTrainerEffect<T> = {
  type: "Targeted";
  validTargets: (game: Game) => T[];
  effect: TargetedEffect<T>;
};
export type TrainerEffect = ConditionalTrainerEffect | TargetedTrainerEffect<CardSlot>;
