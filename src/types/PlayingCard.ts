import type { GameState } from "@/models/GameState";
import type { Energy } from "./Energy";

export type Effect = (gameState: GameState) => Promise<void>;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "OnAttackDamage"
  | "GameRule";
export type AbilityCondition = "Active" | "OnBench" | "HasDamage";

export interface Ability {
  Name: string;
  Trigger: AbilityTrigger;
  Conditions: AbilityCondition[];
  Effect: Effect;
}
export interface Attack {
  Name: string;
  RequiredEnergy: Energy[];
  Effect: Effect;
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
  Effect: Effect;
}
export interface SupporterCard extends BaseCard {
  CardType: "Supporter";
  Effect: Effect;
}
export interface ToolCard extends BaseCard {
  CardType: "Tool";
  Effect: Effect;
}
export interface StadiumCard extends BaseCard {
  CardType: "Stadium";
  Effect: Effect;
}

export type TrainerCard = ItemCard | SupporterCard; // | ToolCard | StadiumCard
export type PlayingCard = PokemonCard | TrainerCard;
