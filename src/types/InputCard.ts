export interface InputCardAbility {
  Name: string;
  Effect: string;
}
export interface InputCardMove {
  Name: string;
  Energy: string;
  HP?: number;
  Effect?: string;
}
export interface BaseInputCard {
  ID: string;
  Name: string;
  Rarity: string;
  SetID: string;
  PackID: string;
}
export interface PokemonInputCard extends BaseInputCard {
  CardType: "Pokemon";
  Type: string;
  HP: number;
  Stage: number;
  EvolvesFrom?: string;
  RetreatCost: number;
  Weakness: string;
  Moves: InputCardMove[];
  Ability?: InputCardAbility;
}
export interface TrainerInputCard extends BaseInputCard {
  CardType: "Item" | "Supporter";
  Text: string;
}

export type InputCard = PokemonInputCard | TrainerInputCard;
