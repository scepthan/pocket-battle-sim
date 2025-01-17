export interface Ability {
  Name: string;
  Effect: string;
}
export interface Move {
  Name: string;
  Energy: string;
  HP?: number;
  Effect?: string;
}
export interface BaseCard {
  ID: string;
  Name: string;
  Rarity: string;
  SetID: string;
  PackID: string;
  CardType: string;
}
export interface PokemonCard extends BaseCard {
  Type: string;
  HP: number;
  Stage: number;
  RetreatCost: number;
  Weakness: string;
  Moves: Move[];
  Ability?: Ability;
}
export interface TrainerCard extends BaseCard {
  Text: string;
}

export type InputCard = PokemonCard | TrainerCard;
