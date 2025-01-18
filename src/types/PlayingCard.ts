import type { GameState } from "@/models/GameState";
import type { Energy } from "./Energy";

export type Effect = (gameState: GameState) => void;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "OnAttackDamage"
  | "GameRule";
export type Condition = "Active" | "OnBench" | "HasDamage";
export type PrimaryStatus = "Asleep"; // | "Paralyzed" | "Confused"
export type SecondaryStatus = "Poisoned"; // | "Burned"

export interface Ability {
  Name: string;
  Trigger: AbilityTrigger;
  Conditions: Condition[];
  Effect: Effect;
}
export interface Move {
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
  RetreatCost?: number;
  Weakness?: string;
  PrizePoints: number;
  Moves: Move[];
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

export type PlayingCard = PokemonCard | ItemCard | SupporterCard;
