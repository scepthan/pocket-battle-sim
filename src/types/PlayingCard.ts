export type Effect = (...args: unknown[]) => void;
export type AbilityTrigger =
  | "OnceDuringTurn"
  | "ManyDuringTurn"
  | "OnAttackDamage"
  | "GameRule";
export type Condition = "Active" | "OnBench" | "HasDamage";
export type PrimaryStatus = "Asleep"; // | "Paralyzed" | "Confused"
export type SecondaryStatus = "Poisoned"; // | "Burned"
export const EnergyMap = {
  C: "Colorless",
  G: "Grass",
  R: "Fire",
  W: "Water",
  L: "Lightning",
  P: "Psychic",
  F: "Fighting",
  D: "Darkness",
  M: "Metal",
} as const;
export type Energy = (typeof EnergyMap)[keyof typeof EnergyMap];

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
  Type: string;
  BaseHP: number;
  Stage: number;
  EvolvesFrom?: string;
  RetreatCost?: number;
  Weakness?: string;
  PrizePoints: number;
  Moves: Move[];
  Ability?: Ability;

  CurrentHP: number;
  PrimaryStatus?: PrimaryStatus;
  SecondaryStatuses: SecondaryStatus[];
  AttachedEnergy: Energy[];
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
