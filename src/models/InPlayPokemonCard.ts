import type { Energy } from "@/types/Energy";
import type {
  Ability,
  PokemonCard as IPokemonCard,
  Move,
} from "@/types/PlayingCard";

export type PrimaryStatus = "Asleep"; // | "Paralyzed" | "Confused"
export type SecondaryStatus = "Poisoned"; // | "Burned"

export class InPlayPokemonCard implements IPokemonCard {
  ID: string;
  Name: string;
  CardType: "Pokemon";
  Type: Energy;
  BaseHP: number;
  Stage: number;
  EvolvesFrom?: string;
  RetreatCost: number;
  Weakness: string;
  PrizePoints: number;
  Moves: Move[];
  Ability?: Ability;

  CurrentHP: number;
  PrimaryStatus?: PrimaryStatus;
  SecondaryStatuses: SecondaryStatus[];
  AttachedEnergy: Energy[];
  CanEvolve: boolean;

  constructor(inputCard: IPokemonCard) {
    this.ID = inputCard.ID;
    this.Name = inputCard.Name;
    this.CardType = inputCard.CardType;
    this.Type = inputCard.Type;
    this.BaseHP = inputCard.BaseHP;
    this.Stage = inputCard.Stage;
    this.EvolvesFrom = inputCard.EvolvesFrom;
    this.RetreatCost = inputCard.RetreatCost;
    this.Weakness = inputCard.Weakness;
    this.PrizePoints = inputCard.PrizePoints;
    this.Moves = inputCard.Moves;
    this.Ability = inputCard.Ability;

    this.CurrentHP = this.BaseHP;
    this.SecondaryStatuses = [];
    this.AttachedEnergy = [];
    this.CanEvolve = false;
  }

  applyDamage(HP: number) {
    this.CurrentHP -= HP;
    if (this.CurrentHP < 0) this.CurrentHP = 0;
  }

  healDamage(HP: number) {
    this.CurrentHP += HP;
    if (this.CurrentHP > this.BaseHP) this.CurrentHP = this.BaseHP;
  }
}
