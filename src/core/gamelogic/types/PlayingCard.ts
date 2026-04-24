import type { Ability } from "./ability/Ability";
import type { Attack } from "./Attack";
import type { Energy } from "./Energy";
import type { TrainerEffect } from "./TrainerEffect";

export interface BaseCard {
  id: string;
  name: string;
  rarity: string;
  parseSuccessful: boolean;
}
export interface PokemonCard extends BaseCard {
  cardType: "Pokemon";
  type: Energy;
  baseHP: number;
  stage: number;
  evolvesFrom?: string;
  retreatCost: number;
  weakness?: Energy;
  prizePoints: number;
  attacks: Attack[];
  ability?: Ability;
  isUltraBeast?: boolean;
}
export interface ItemCard extends BaseCard {
  cardType: "Item";
  text: string;
  effect: TrainerEffect;
}
export interface FossilCard extends BaseCard {
  cardType: "Fossil";
  text: string;
  baseHP: number;
  type: Energy;
}
export interface SupporterCard extends BaseCard {
  cardType: "Supporter";
  text: string;
  effect: TrainerEffect;
}

export interface PokemonToolCard extends BaseCard {
  cardType: "PokemonTool";
  text: string;
  effect: Ability;
}
export interface StadiumCard extends BaseCard {
  cardType: "Stadium";
  text: string;
  effect: Ability;
}

export type TrainerCard = ItemCard | FossilCard | SupporterCard | PokemonToolCard | StadiumCard;
export type PlayingCard = PokemonCard | TrainerCard;
