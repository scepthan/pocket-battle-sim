import { removeElement } from "../util";
import type { Game } from "./Game";
import type { Player } from "./Player";
import {
  type Ability,
  type Attack,
  type CardSlot,
  type Energy,
  type PlayerStatus,
  type PlayingCard,
  type PokemonCard,
  type PokemonStatus,
  type PrimaryCondition,
  type SecondaryCondition,
} from "./types";

export class InPlayPokemonCard {
  BaseCard: PokemonCard;
  player: Player;
  game: Game;

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
  MaxHP: number;
  AttachedEnergy: Energy[] = [];

  PrimaryCondition?: PrimaryCondition;
  SecondaryConditions: Set<SecondaryCondition> = new Set();
  PokemonStatuses: PokemonStatus[] = [];
  ActivePlayerStatuses: PlayerStatus[] = []; // PlayerStatuses currently in play from this Pokemon's Ability

  InPlayCards: PlayingCard[] = [];
  ReadyToEvolve: boolean = false;

  isPokemon = true as const;

  get CurrentConditions() {
    return [this.PrimaryCondition, ...this.SecondaryConditions].filter(
      (condition) => condition !== undefined
    );
  }

  get EffectiveEnergy() {
    return this.calculateEffectiveEnergy(this.AttachedEnergy);
  }

  calculateEffectiveEnergy(energies: Energy[]) {
    const energiesToDouble = new Set<Energy>();
    for (const status of this.player.PlayerStatuses) {
      if (status.type === "DoubleEnergy" && status.appliesToPokemon(this, this.player.game)) {
        energiesToDouble.add(status.energyType);
      }
    }

    const effectiveEnergy: Energy[] = [];
    for (const energy of energies) {
      effectiveEnergy.push(energy);
      if (energiesToDouble.has(energy)) {
        effectiveEnergy.push(energy);
      }
    }
    return effectiveEnergy;
  }

  constructor(player: Player, inputCard: PokemonCard, trueCard: PlayingCard = inputCard) {
    this.player = player;
    this.game = player.game;
    this.BaseCard = inputCard;
    this.InPlayCards.push(trueCard);

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
    this.MaxHP = this.BaseHP;
  }

  evolveInto(inputCard: PokemonCard) {
    this.BaseCard = inputCard;
    this.InPlayCards.push(inputCard);

    const hpIncrease = inputCard.BaseHP - this.BaseHP;
    this.CurrentHP += hpIncrease;
    this.MaxHP += hpIncrease;

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

  isDamaged() {
    return this.CurrentHP < this.MaxHP;
  }

  applyDamage(HP: number) {
    this.CurrentHP -= HP;
    if (this.CurrentHP < 0) this.CurrentHP = 0;
  }

  healDamage(HP: number) {
    this.CurrentHP += HP;
    if (this.CurrentHP > this.MaxHP) this.CurrentHP = this.MaxHP;
  }

  attachEnergy(energy: Energy[]) {
    this.AttachedEnergy.push(...energy);
  }

  hasSufficientEnergy(energies: Energy[]) {
    // Move Colorless energy to the end of the list so colored Energies are checked first
    energies = energies
      .slice()
      .sort((a, b) => (a == "Colorless" ? 1 : 0) - (b == "Colorless" ? 1 : 0));
    const energyAvailable = this.EffectiveEnergy.slice();
    for (const energy of energies) {
      if (energy === "Colorless" && energyAvailable.length > 0) {
        energyAvailable.pop();
      } else if (energyAvailable.includes(energy)) {
        removeElement(energyAvailable, energy);
      } else {
        return false;
      }
    }
    return true;
  }

  async useAbility(manuallyActivated: boolean, target?: CardSlot) {
    if (!this.Ability) return;
    if (!target && this.Ability.effect.type == "Targeted")
      throw new Error("No target provided for targeted ability");

    if (manuallyActivated) {
      this.player.logger.useAbility(this.player, this, this.Ability.name);
    } else {
      this.player.logger.triggerAbility(this.player, this, this.Ability.name);
    }

    await this.Ability.effect.effect(this.game, this, target!);
  }

  async onEnterPlay() {
    if (this.Ability?.trigger === "OnEnterPlay") {
      await this.player.triggerAbility(this);
    }
  }

  async onEnterActive() {
    if (this.Ability?.trigger === "OnEnterActive") {
      await this.player.triggerAbility(this);
    }
  }

  async onLeaveActive() {
    if (this.Ability?.trigger === "OnEnterActive" && this.Ability.effect.undo) {
      await this.Ability.effect.undo(this.game, this);
    }
  }

  async onEnterBench() {
    if (this.Ability?.trigger === "OnEnterBench") {
      await this.player.triggerAbility(this);
    }
  }

  async onLeaveBench() {
    if (this.Ability?.trigger === "OnEnterBench" && this.Ability.effect.undo) {
      await this.Ability.effect.undo(this.game, this);
    }
  }

  async onLeavePlay() {
    if (this.Ability?.trigger === "OnEnterPlay" && this.Ability.effect.undo) {
      await this.Ability.effect.undo(this.game, this);
    }
  }

  async onAttackDamage() {
    if (this.Ability?.trigger === "AfterAttackDamage") {
      if (this.game.DefendingPlayer.InPlayPokemon.includes(this))
        await this.player.triggerAbility(this);
    }
  }
}
