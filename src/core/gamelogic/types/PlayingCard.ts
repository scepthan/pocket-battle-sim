import type { Ability } from "./Ability";
import type { Attack } from "./Attack";
import type { BasicEffect } from "./BasicEffect";
import type { Energy } from "./Energy";
import type { TrainerEffect } from "./TrainerEffect";

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
