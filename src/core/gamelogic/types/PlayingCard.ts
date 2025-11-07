import type { Ability } from "./ability/Ability";
import type { Attack } from "./Attack";
import type { BasicEffect, PokemonConditional, PokemonEffect } from "./Effects";
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
export interface FossilCard extends BaseCard {
  CardType: "Fossil";
  Text: string;
  Effect: TrainerEffect;
}
export interface SupporterCard extends BaseCard {
  CardType: "Supporter";
  Text: string;
  Effect: TrainerEffect;
}

export type PokemonToolTrigger = "OnAttach" | "OnAttackDamage" | "OnTurnEnd" | "OnKnockOut";
export interface PokemonToolEffect {
  trigger: PokemonToolTrigger;
  conditions: PokemonConditional[];
  effect: PokemonEffect;
  undo?: PokemonEffect;
}
export interface PokemonToolCard extends BaseCard {
  CardType: "PokemonTool";
  Text: string;
  Effect: PokemonToolEffect;
}
export interface StadiumCard extends BaseCard {
  CardType: "Stadium";
  Text: string;
  Effect: BasicEffect;
}

export type TrainerCard = ItemCard | FossilCard | SupporterCard | PokemonToolCard; // | StadiumCard
export type PlayingCard = PokemonCard | TrainerCard;
