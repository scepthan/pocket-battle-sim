export interface InputCardAbility {
  name: string;
  text: string;
}
export interface InputCardAttack {
  name: string;
  cost: string;
  damage?: number;
  text?: string;
}
export interface BaseInputCard {
  id: string;
  name: string;
  rarity: string;
  setId: string;
}
export interface PokemonInputCard extends BaseInputCard {
  cardType: "Pokemon";
  type: string;
  hp: number;
  stage: number;
  previousEvolution?: string;
  retreatCost: number;
  weakness: string;
  attacks: InputCardAttack[];
  ability?: InputCardAbility;
}
export interface TrainerInputCard extends BaseInputCard {
  cardType: "Item" | "Fossil" | "Supporter" | "PokemonTool";
  text: string;
}

export type InputCard = PokemonInputCard | TrainerInputCard;
