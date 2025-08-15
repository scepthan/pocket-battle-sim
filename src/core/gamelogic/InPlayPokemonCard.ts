import type { Game } from "./Game";
import type {
  Ability,
  Attack,
  Energy,
  PlayingCard,
  PokemonCard,
  PokemonStatus,
  PrimaryCondition,
  SecondaryCondition,
} from "./types";

export class InPlayPokemonCard {
  BaseCard: PokemonCard;

  ID: string;
  Name: string;
  Type: Energy;
  BaseHP: number;
  Stage: number;
  RetreatCost: number;
  Weakness?: string;
  PrizePoints: number;
  Attacks: Attack[];
  Ability?: Ability;

  CurrentHP: number;
  PrimaryCondition?: PrimaryCondition;
  SecondaryConditions: Set<SecondaryCondition> = new Set();
  get CurrentConditions() {
    return [this.PrimaryCondition, ...this.SecondaryConditions].filter(
      (condition) => condition !== undefined
    );
  }
  PokemonStatuses: PokemonStatus[] = [];
  AttachedEnergy: Energy[] = [];
  InPlayCards: PlayingCard[] = [];
  ReadyToEvolve: boolean = false;

  isPokemon = true as const;

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

  evolveInto(inputCard: PokemonCard) {
    this.BaseCard = inputCard;
    this.InPlayCards.push(inputCard);

    this.CurrentHP += inputCard.BaseHP - this.BaseHP;

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
    // Move Colorless energy to the end of the list so colored Energies are checked first
    energies = energies
      .slice()
      .sort((a, b) => (a == "Colorless" ? 1 : 0) - (b == "Colorless" ? 1 : 0));
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

  async onEnterPlay(game: Game) {
    if (this.Ability?.Trigger === "OnEnterPlay") {
      await game.findOwner(this).triggerAbility(this);
    }
  }

  async onEnterActive(game: Game) {
    if (this.Ability?.Trigger === "OnEnterActive") {
      await game.findOwner(this).triggerAbility(this);
    }
  }

  async onLeaveActive(game: Game) {
    if (this.Ability?.Trigger === "OnEnterActive" && this.Ability.UndoEffect) {
      await this.Ability.UndoEffect(game, this);
    }
  }

  async onEnterBench(game: Game) {
    if (this.Ability?.Trigger === "OnEnterBench") {
      await game.findOwner(this).triggerAbility(this);
    }
  }

  async onLeaveBench(game: Game) {
    if (this.Ability?.Trigger === "OnEnterBench" && this.Ability.UndoEffect) {
      await this.Ability.UndoEffect(game, this);
    }
  }

  async onAttackDamage(game: Game) {
    if (this.Ability?.Trigger === "AfterAttackDamage") {
      if (this.Ability.Conditions.includes("Active")) {
        if (game.DefendingPlayer.ActivePokemon === this)
          await game.findOwner(this).triggerAbility(this);
      } else if (this.Ability.Conditions.includes("OnBench")) {
        if (game.DefendingPlayer.BenchedPokemon.includes(this))
          await game.findOwner(this).triggerAbility(this);
      }
    }
  }
}
