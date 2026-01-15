import type { GameLogger } from "../logging";
import { randomElement, removeElement, sortedBy } from "../util";
import type { Game } from "./Game";
import type { Player } from "./Player";
import {
  EnergyMap,
  type Ability,
  type Energy,
  type PlayerStatus,
  type PlayingCard,
  type PokemonCard,
  type PokemonPlayerStatus,
  type PokemonStatus,
  type PokemonToolCard,
  type PrimaryCondition,
  type SecondaryCondition,
} from "./types";

export class InPlayPokemon {
  BaseCard: PokemonCard;
  player: Player;
  game: Game;
  logger: GameLogger;

  get ID() {
    return this.BaseCard.ID;
  }
  get Name() {
    return this.BaseCard.Name;
  }
  get Type() {
    return this.BaseCard.Type;
  }
  get BaseHP() {
    return this.BaseCard.BaseHP;
  }
  get Stage() {
    return this.BaseCard.Stage;
  }
  get RetreatCost() {
    return this.BaseCard.RetreatCost;
  }
  get Weakness() {
    return this.BaseCard.Weakness;
  }
  get PrizePoints() {
    return this.BaseCard.PrizePoints;
  }
  get Attacks() {
    return this.BaseCard.Attacks;
  }
  get Ability() {
    return this.BaseCard.Ability;
  }
  get effectiveAbilities() {
    const abilities = this.Ability ? [this.Ability] : [];
    for (const tool of this.AttachedToolCards) {
      abilities.push(tool.Effect);
    }
    return abilities;
  }
  get isUltraBeast() {
    return this.BaseCard.isUltraBeast === true;
  }

  CurrentHP: number;
  MaxHP: number;
  AttachedEnergy: Energy[] = [];
  AttachedToolCards: PokemonToolCard[] = [];
  MaxToolCards: number = 1;

  PrimaryCondition?: PrimaryCondition;
  SecondaryConditions: Set<SecondaryCondition> = new Set();
  private _PokemonStatuses: PokemonStatus[] = [];
  get PokemonStatuses() {
    const filteredPlayerStatuses = this.player.PlayerStatuses.filter(
      (status) => status.type === "PokemonStatus" && status.pokemonCondition.test(this)
    ) as PokemonPlayerStatus[];

    return this._PokemonStatuses.concat(
      filteredPlayerStatuses.map((status) => status.pokemonStatus)
    );
  }
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
    for (const status of this.PokemonStatuses) {
      if (status.type === "DoubleEnergy") {
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

    this.CurrentHP = this.BaseHP;
    this.MaxHP = this.BaseHP;
  }

  evolveInto(inputCard: PokemonCard) {
    const hpIncrease = inputCard.BaseHP - this.BaseHP;

    this.BaseCard = inputCard;
    this.InPlayCards.push(inputCard);
    this.ReadyToEvolve = false;

    this.CurrentHP += hpIncrease;
    this.MaxHP += hpIncrease;
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

  /**
   * Heals a set amount of damage from this Pokémon.
   */
  healDamage(HP: number): number {
    if (this.PokemonStatuses.some((s) => s.type === "CannotHeal")) {
      this.logger.effectPrevented(this.player, this);
      return 0;
    }

    const initialHP = this.CurrentHP;

    this.CurrentHP += HP;
    if (this.CurrentHP > this.MaxHP) this.CurrentHP = this.MaxHP;

    this.logger.pokemonHealed(this.player, this, initialHP, HP);

    return this.CurrentHP - initialHP;
  }

  attachEnergy(energy: Energy[]) {
    const energyOrder = Object.values(EnergyMap);
    for (const e of energy) {
      const index = this.AttachedEnergy.findIndex(
        (en) => energyOrder.indexOf(e) < energyOrder.indexOf(en)
      );
      if (index !== -1) {
        this.AttachedEnergy.splice(index, 0, e);
      } else {
        this.AttachedEnergy.push(e);
      }
    }
  }
  removeEnergy(energy: Energy[]) {
    for (const e of energy) removeElement(this.AttachedEnergy, e);
  }

  isPoisoned() {
    return this.SecondaryConditions.has("Poisoned") || this.SecondaryConditions.has("Poisoned+");
  }
  isBurned() {
    return this.SecondaryConditions.has("Burned");
  }
  hasSpecialCondition() {
    return this.CurrentConditions.length > 0;
  }

  /**
   * Recovers this Pokemon from a random Special Condition.
   */
  removeRandomSpecialCondition() {
    const conditions = this.CurrentConditions;
    if (conditions.length == 0) return;

    const condition = randomElement(conditions);

    if (condition === "Asleep" || condition === "Confused" || condition === "Paralyzed") {
      this.PrimaryCondition = undefined;
    } else {
      this.SecondaryConditions.delete(condition);
    }

    this.logger.specialConditionEnded(this, [condition]);
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

    this._PokemonStatuses = this._PokemonStatuses.filter((status) => status.source != "Effect");
  }

  /**
   * Applies a PokemonStatus to this Pokemon and deals with any immediate effects.
   *
   * Applies unconditionally; to check for effect prevention, use Game.applyPokemonStatus().
   */
  applyPokemonStatus(status: PokemonStatus) {
    this._PokemonStatuses.push(status);
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
    removeElement(this._PokemonStatuses, status);
    this.logger.removePokemonStatus(this, status);

    if (status.type === "IncreaseMaxHP") {
      const hpIncrease = status.amount;
      this.MaxHP -= hpIncrease;
      this.CurrentHP -= hpIncrease;
    }
  }

  /**
   * Updates PokemonStatuses at the end of the turn, removing those that should expire.
   */
  updatePokemonStatusesAtTurnEnd() {
    const newStatuses: PokemonStatus[] = [];
    for (const status of this._PokemonStatuses) {
      if (status.source == "Effect" || status.turnsToKeep !== undefined) {
        if (status.turnsToKeep) {
          status.turnsToKeep -= 1;
          newStatuses.push(status);
        }
      } else {
        newStatuses.push(status);
      }
    }
    this._PokemonStatuses = newStatuses;
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
  }

  private energyIsSufficient(energies: Energy[], energyAvailable: Energy[]) {
    // Move Colorless energy to the end of the list so colored Energies are checked first
    energies = sortedBy(energies, (a) => a === "Colorless");
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

  async triggerAbility(ability: Ability) {
    await this.useAbility(ability, false);
  }

  async useAbility(ability: Ability, manuallyActivated: boolean) {
    if (!ability) {
      throw new Error("Pokemon has no ability");
    }
    if (ability.type === "Status") {
      throw new Error("Status ability cannot be used");
    }

    if (!ability.conditions.every((condition) => condition(this.player, this))) return;

    if (manuallyActivated) {
      this.player.logger.useAbility(this.player, this, ability.name);
    } else {
      this.player.logger.triggerAbility(this.player, this, ability.name);
    }

    let heads = 0;
    if (ability.effect.coinsToFlip) {
      heads = this.player.flipCoinsForEffect(ability.effect.coinsToFlip, this);
    }

    let target: InPlayPokemon | undefined;
    if (ability.effect.type === "Targeted") {
      const validTargets = ability.effect.validTargets(this.player, this);
      if (validTargets.length === 0) return;
      if (!validTargets.every((x) => x.isPokemon)) {
        throw new Error("Targeted ability effect has non-Pokemon valid targets");
      }

      target = await this.player.game.choosePokemon(this.player, validTargets);
      if (!target || !validTargets.includes(target)) {
        throw new Error("Invalid target for targeted effect");
      }
    }
    for (const effect of ability.effect.sideEffects) {
      await effect(this.game, this, heads, target);
    }
  }

  // Event handlers for abilities and tools
  async onEnterPlay() {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "OnEnterPlay") {
        await this.triggerAbility(ability);
      }
    }
  }

  async onEnergyZoneAttach(energy: Energy[]) {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "OnEnergyZoneAttach") {
        const expectedEnergy = ability.trigger.energy;
        for (const e of energy) {
          if (!expectedEnergy || expectedEnergy === e) await this.triggerAbility(ability);
        }
      }
    }
  }

  async afterDamagedByAttack() {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "AfterDamagedByAttack") {
        if (this.game.DefendingPlayer.InPlayPokemon.includes(this))
          await this.triggerAbility(ability);
      }
    }
    for (const status of this.PokemonStatuses) {
      if (status.type === "CounterAttack")
        this.game.applyDamage(this.game.AttackingPokemon!, status.amount, false);
    }
  }

  async beforeKnockedOutByAttack() {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "BeforeKnockedOutByAttack") {
        if (this.game.DefendingPlayer.InPlayPokemon.includes(this))
          await this.triggerAbility(ability);
      }
    }
  }

  async afterKnockedOutByAttack() {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "AfterKnockedOutByAttack") {
        if (this.game.DefendingPlayer.InPlayPokemon.includes(this))
          await this.triggerAbility(ability);
      }
    }
  }
}
