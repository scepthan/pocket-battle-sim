import type { EmptyCardSlot, Game, InPlayPokemonCard, Player } from "../gamelogic";
import type { Energy } from "./Energy";

export type BasicEffect = (game: Game) => Promise<void>;
export type AbilityEffect = (game: Game, pokemon: InPlayPokemonCard) => Promise<void>;
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
export type CardSlot = InPlayPokemonCard | EmptyCardSlot;
export type TrainerEffect = ConditionalTrainerEffect | TargetedTrainerEffect<CardSlot>;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "AfterAttackDamage"
  | "OnEnterPlay"
  | "GameRule";
export type AbilityCondition = "Active" | "OnBench" | "HasDamage";

export interface Ability {
  Name: string;
  Trigger: AbilityTrigger;
  Conditions: AbilityCondition[];
  Text: string;
  Effect: AbilityEffect;
}
export interface Attack {
  Name: string;
  RequiredEnergy: Energy[];
  Effect: BasicEffect;
  Text?: string;
  Damage?: number;
}

export interface BaseCard {
  ID: string;
  Name: string;
}
export interface PokemonCard extends BaseCard {
  CardType: "Pokemon";
  Type: Energy;
  BaseHP: number;
  Stage: number;
  EvolvesFrom?: string;
  RetreatCost: number;
  Weakness: string;
  PrizePoints: number;
  Attacks: Attack[];
  Ability?: Ability;
}
export interface ItemCard extends BaseCard {
  CardType: "Item";
  Text: string;
  Effect: TrainerEffect;
}
export interface SupporterCard extends BaseCard {
  CardType: "Supporter";
  Text: string;
  Effect: TrainerEffect;
}
export interface ToolCard extends BaseCard {
  CardType: "Tool";
  Text: string;
  Effect: BasicEffect;
}
export interface StadiumCard extends BaseCard {
  CardType: "Stadium";
  Text: string;
  Effect: BasicEffect;
}

export type TrainerCard = ItemCard | SupporterCard; // | ToolCard | StadiumCard
export type PlayingCard = PokemonCard | TrainerCard;
