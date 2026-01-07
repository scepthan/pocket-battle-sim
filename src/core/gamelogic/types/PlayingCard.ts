import type { Ability } from "./ability/Ability";
import type { Attack } from "./Attack";
import type { BasicEffect } from "./Effects";
import type { Energy } from "./Energy";
import type { TrainerEffect } from "./TrainerEffect";

export interface BaseCard {
  ID: string;
  Name: string;
  Rarity: string;
}
export interface PokemonCard extends BaseCard {
  CardType: "Pokemon";
  Type: Energy;
  BaseHP: number;
  Stage: number;
  EvolvesFrom?: string;
  RetreatCost: number;
  Weakness?: Energy;
  PrizePoints: number;
  Attacks: Attack[];
  Ability?: Ability;
  isUltraBeast?: boolean;
}
export interface ItemCard extends BaseCard {
  CardType: "Item";
  Text: string;
  Effect: TrainerEffect;
}
export interface FossilCard extends BaseCard {
  CardType: "Fossil";
  Text: string;
  BaseHP: number;
  Type: Energy;
}
export interface SupporterCard extends BaseCard {
  CardType: "Supporter";
  Text: string;
  Effect: TrainerEffect;
}

export interface PokemonToolCard extends BaseCard {
  CardType: "PokemonTool";
  Text: string;
  Effect: Ability;
}
export interface StadiumCard extends BaseCard {
  CardType: "Stadium";
  Text: string;
  Effect: BasicEffect;
}

export type TrainerCard = ItemCard | FossilCard | SupporterCard | PokemonToolCard; // | StadiumCard
export type PlayingCard = PokemonCard | TrainerCard;
