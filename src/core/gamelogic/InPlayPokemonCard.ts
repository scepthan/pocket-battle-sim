import type { GameLogger } from "../logging";
import { removeElement } from "../util";
import type { Game } from "./Game";
import type { Player } from "./Player";
import {
  type Ability,
  type Attack,
  type Energy,
  type PlayerStatus,
  type PlayingCard,
  type PokemonCard,
  type PokemonStatus,
  type PokemonToolCard,
  type PrimaryCondition,
  type SecondaryCondition,
} from "./types";

export class InPlayPokemonCard {
  BaseCard: PokemonCard;
  player: Player;
  game: Game;
  logger: GameLogger;

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
  AttachedToolCards: PokemonToolCard[] = [];
  MaxToolCards: number = 1;

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
    this.logger = player.logger;
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
  currentDamage() {
    return this.MaxHP - this.CurrentHP;
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
  removeEnergy(energy: Energy[]) {
    for (const e of energy) removeElement(this.AttachedEnergy, e);
  }

  /**
   * Recovers this Pokemon from all Special Conditions.
   */
  removeAllSpecialConditions() {
    const conditions = this.CurrentConditions;
    if (conditions.length == 0) return;

    this.PrimaryCondition = undefined;
    this.SecondaryConditions = new Set();

    this.logger.specialConditionEnded(this, conditions);
  }

  /**
   * Recovers this Pokemon from all Special Conditions and removes all "Effect" PokemonStatuses.
   */
  removeAllSpecialConditionsAndStatuses() {
    this.removeAllSpecialConditions();

    this.PokemonStatuses = this.PokemonStatuses.filter((status) => status.source != "Effect");
  }

  /**
   * Applies a PokemonStatus to this Pokemon and deals with any immediate effects.
   *
   * Applies unconditionally; to check for effect prevention, use Game.applyPokemonStatus().
   */
  applyPokemonStatus(status: PokemonStatus) {
    this.PokemonStatuses.push(status);
    this.logger.applyPokemonStatus(this.player, this, status);

    if (status.type === "IncreaseMaxHP") {
      const hpIncrease = status.amount;
      this.MaxHP += hpIncrease;
      this.CurrentHP += hpIncrease;
    }
  }

  /**
   * Removes a PokemonStatus from this Pokemon and deals with any side effects.
   */
  removePokemonStatus(status: PokemonStatus) {
    removeElement(this.PokemonStatuses, status);

    if (status.type === "IncreaseMaxHP") {
      const hpIncrease = status.amount;
      this.MaxHP -= hpIncrease;
      this.CurrentHP -= hpIncrease;
    }
  }

  /**
   * Attaches a PokemonTool to this Pokemon and deals with any immediate effects.
   *
   * Does not check if a tool can be attached; that should be done before calling this method.
   */
  async attachPokemonTool(card: PokemonToolCard) {
    this.logger.attachPokemonTool(this.player, card, this);
    this.AttachedToolCards.push(card);
    this.InPlayCards.push(card);
    this.player.InPlay.push(card);

    if (card.Effect.trigger === "OnAttach") await this.triggerPokemonTool(card);
  }

  /**
   * Removes a PokemonTool from this Pokemon and deals with any side effects.
   *
   * Removes the card from in play, but does not discard it or return it to the hand.
   */
  async removePokemonTool(card: PokemonToolCard) {
    this.logger.removePokemonTool(this.player, card, this);
    removeElement(this.AttachedToolCards, card);
    removeElement(this.InPlayCards, card);
    removeElement(this.player.InPlay, card);

    if (card.Effect.trigger === "OnAttach" && card.Effect.undo)
      await card.Effect.undo(this.game, this);
  }

  private energyIsSufficient(energies: Energy[], energyAvailable: Energy[]) {
    // Move Colorless energy to the end of the list so colored Energies are checked first
    energies = energies
      .slice()
      .sort((a, b) => (a == "Colorless" ? 1 : 0) - (b == "Colorless" ? 1 : 0));
    energyAvailable = energyAvailable.slice();

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

  hasSufficientEnergy(energies: Energy[]) {
    return this.energyIsSufficient(energies, this.EffectiveEnergy);
  }
  hasSufficientActualEnergy(energies: Energy[]) {
    return this.energyIsSufficient(energies, this.AttachedEnergy);
  }

  async triggerAbility() {
    await this.useAbility(false);
  }

  async useAbility(manuallyActivated: boolean) {
    const ability = this.Ability;
    if (!ability) {
      throw new Error("Pokemon has no ability");
    }

    if (!ability.conditions.every((condition) => condition(this))) return;

    if (manuallyActivated) {
      this.player.logger.useAbility(this.player, this, ability.name);
    } else {
      this.player.logger.triggerAbility(this.player, this, ability.name);
    }

    if (ability.effect.type === "Targeted") {
      const validTargets = ability.effect.findValidTargets(this.player.game, this);
      if (validTargets.length === 0) return;

      const target = validTargets.every((x) => x.isPokemon)
        ? await this.player.game.choosePokemon(this.player, validTargets)
        : await this.player.game.choose(this.player, validTargets);
      if (!target || !validTargets.includes(target)) {
        throw new Error("Invalid target for targeted effect");
      }
      await ability.effect.effect(this.game, this, target);
    } else if (ability.effect.type === "Standard") {
      await ability.effect.effect(this.game, this);
    } else {
      throw new Error(`Ability effect type '${ability.effect.type}' cannot be used`);
    }
  }

  async triggerPokemonTool(tool: PokemonToolCard) {
    this.logger.triggerPokemonTool(this.player, tool, this);
    await tool.Effect.effect(this.game, this);
  }

  // Event handlers for abilities and tools
  async onEnterPlay() {
    if (this.Ability?.type === "Standard" && this.Ability.trigger.type === "OnEnterPlay") {
      await this.triggerAbility();
    }
  }

  async onEnergyZoneAttach(energy: Energy[]) {
    if (this.Ability?.type === "Standard" && this.Ability.trigger.type === "OnEnergyZoneAttach") {
      const expectedEnergy = this.Ability.trigger.energy;
      for (const e of energy) {
        if (!expectedEnergy || expectedEnergy === e) await this.triggerAbility();
      }
    }
  }

  async afterDamagedByAttack() {
    if (this.Ability?.type === "Standard" && this.Ability.trigger.type === "AfterDamagedByAttack") {
      if (this.game.DefendingPlayer.InPlayPokemon.includes(this)) await this.triggerAbility();
    }
    for (const tool of this.AttachedToolCards) {
      if (tool.Effect.trigger === "OnAttackDamage") await this.triggerPokemonTool(tool);
    }
  }
}
