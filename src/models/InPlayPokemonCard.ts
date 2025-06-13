import type {
  Ability,
  Attack,
  Energy,
  PlayingCard,
  PokemonCard,
} from "@/types";

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
  Attacks: Attack[];
  Ability?: Ability;

  CurrentHP: number;
  PrimaryStatus?: PrimaryStatus;
  SecondaryStatuses: SecondaryStatus[] = [];
  AttachedEnergy: Energy[] = [];
  InPlayCards: PlayingCard[] = [];
  ReadyToEvolve: boolean = false;

  constructor(inputCard: PokemonCard) {
    this.BaseCard = inputCard;
    this.InPlayCards.push(inputCard);

    this.ID = inputCard.ID;
    this.Name = inputCard.Name;
    this.Type = inputCard.Type;
    this.BaseHP = inputCard.BaseHP;
    this.Stage = inputCard.Stage;
    this.RetreatCost = inputCard.RetreatCost;
    this.Weakness = inputCard.Weakness;
    this.PrizePoints = inputCard.PrizePoints;
    this.Attacks = inputCard.Attacks;
    this.Ability = inputCard.Ability;

    this.CurrentHP = this.BaseHP;
  }

  applyDamage(HP: number) {
    this.CurrentHP -= HP;
    if (this.CurrentHP < 0) this.CurrentHP = 0;
  }

  healDamage(HP: number) {
    this.CurrentHP += HP;
    if (this.CurrentHP > this.BaseHP) this.CurrentHP = this.BaseHP;
  }

  attachEnergy(energy: Energy[]) {
    this.AttachedEnergy.push(...energy);
  }

  hasSufficientEnergy(energies: Energy[]) {
    const energyAvailable = this.AttachedEnergy.slice();
    for (const energy of energies) {
      if (energy === "Colorless" && energyAvailable.length > 0) {
        energyAvailable.pop();
      } else if (energyAvailable.includes(energy)) {
        energyAvailable.splice(energyAvailable.indexOf(energy), 1);
      } else {
        return false;
      }
    }
    return true;
  }
}
