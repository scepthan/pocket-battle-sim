import type { Energy } from "@/types/Energy";
import type { Ability, PokemonCard, Move } from "@/types/PlayingCard";

export type PrimaryStatus = "Asleep"; // | "Paralyzed" | "Confused"
export type SecondaryStatus = "Poisoned"; // | "Burned"

export class InPlayPokemonCard {
  BaseCard: PokemonCard;

  ID: string;
  Name: string;
  Type: Energy;
  BaseHP: number;
  Stage: number;
  RetreatCost?: number;
  Weakness?: string;
  PrizePoints: number;
  Moves: Move[];
  Ability?: Ability;

  CurrentHP: number;
  PrimaryStatus?: PrimaryStatus;
  SecondaryStatuses: SecondaryStatus[];
  AttachedEnergy: Energy[];
  ReadyToEvolve: boolean;

  constructor(inputCard: PokemonCard) {
    this.BaseCard = inputCard;

    this.ID = inputCard.ID;
    this.Name = inputCard.Name;
    this.Type = inputCard.Type;
    this.BaseHP = inputCard.BaseHP;
    this.Stage = inputCard.Stage;
    this.RetreatCost = inputCard.RetreatCost;
    this.Weakness = inputCard.Weakness;
    this.PrizePoints = inputCard.PrizePoints;
    this.Moves = inputCard.Moves;
    this.Ability = inputCard.Ability;

    this.CurrentHP = this.BaseHP;
    this.SecondaryStatuses = [];
    this.AttachedEnergy = [];
    this.ReadyToEvolve = false;
  }

  applyDamage(HP: number) {
    this.CurrentHP -= HP;
    if (this.CurrentHP < 0) this.CurrentHP = 0;
  }

  healDamage(HP: number) {
    this.CurrentHP += HP;
    if (this.CurrentHP > this.BaseHP) this.CurrentHP = this.BaseHP;
  }

  attachEnergy(energy: Energy) {
    this.AttachedEnergy.push(energy);
  }
}
