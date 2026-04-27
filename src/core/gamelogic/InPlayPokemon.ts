import type { GameLogger } from "../logging";
import { randomElement, removeElement, sortedBy } from "../util";
import type { Game } from "./Game";
import type { Player } from "./Player";
import {
  allTypes,
  type Ability,
  type Attack,
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
  baseCard: PokemonCard;
  player: Player;
  game: Game;
  logger: GameLogger;
  id: number;
  get opponent() {
    return this.player.opponent;
  }

  get location() {
    if (this.player.ActivePokemon === this) return "Active";
    return "Bench";
  }
  get benchIndex() {
    if (this.location === "Active") return -1;
    return this.player.Bench.findIndex((p) => p === this);
  }

  get cardId() {
    return this.baseCard.id;
  }
  get name() {
    return this.baseCard.name;
  }
  get evolvesAs() {
    const status = this.pokemonStatuses.find((s) => s.type === "CanEvolveAs");
    if (status) return status.pokemonName;
    return this.name;
  }
  get type() {
    return this.baseCard.type;
  }
  get baseHP() {
    return this.baseCard.baseHP;
  }
  get stage() {
    return this.baseCard.stage;
  }
  get retreatCost() {
    return this.baseCard.retreatCost;
  }
  get weakness() {
    return this.baseCard.weakness;
  }
  get prizePoints() {
    return this.baseCard.prizePoints;
  }
  get attacks() {
    return this.baseCard.attacks;
  }
  get ability() {
    return this.baseCard.ability;
  }
  get effectiveAbilities() {
    const abilities = this.ability ? [this.ability] : [];
    for (const tool of this.attachedToolCards) {
      abilities.push(tool.effect);
    }
    return abilities;
  }
  get isUltraBeast() {
    return this.baseCard.isUltraBeast === true;
  }

  currentHP: number;
  maxHP: number;
  attachedEnergy: Energy[] = [];
  attachedToolCards: PokemonToolCard[] = [];
  maxToolCards: number = 1;

  primaryCondition?: PrimaryCondition;
  secondaryConditions: Set<SecondaryCondition> = new Set();
  private _pokemonStatuses: PokemonStatus[] = [];
  get pokemonStatuses() {
    const filteredPlayerStatuses = this.player.PlayerStatuses.filter(
      (status) => status.type === "PokemonStatus" && status.pokemonCondition.test(this),
    ) as PokemonPlayerStatus[];

    return this._pokemonStatuses.concat(
      filteredPlayerStatuses.map((status) => status.pokemonStatus),
    );
  }
  activePlayerStatuses: PlayerStatus[] = []; // PlayerStatuses currently in play from this Pokemon's Ability

  inPlayCards: PlayingCard[] = [];
  playedThisTurn: boolean = true;

  isPokemon = true as const;

  get currentConditions() {
    return [this.primaryCondition, ...this.secondaryConditions].filter(
      (condition) => condition !== undefined,
    );
  }

  get effectiveEnergy() {
    return this.calculateEffectiveEnergy(this.attachedEnergy);
  }

  calculateEffectiveEnergy(energies: Energy[]) {
    const energiesToDouble = new Set<Energy>();
    for (const status of this.pokemonStatuses) {
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
    this.baseCard = inputCard;
    this.inPlayCards.push(trueCard);
    this.id = this.game.nextPokemonId++;

    this.currentHP = this.baseHP;
    this.maxHP = this.baseHP;
  }

  async evolveInto(inputCard: PokemonCard) {
    const hpIncrease = inputCard.baseHP - this.baseHP;

    this.baseCard = inputCard;
    this.inPlayCards.push(inputCard);
    this.playedThisTurn = true;

    this.currentHP += hpIncrease;
    this.maxHP += hpIncrease;

    this.removeAllSpecialConditionsAndStatuses();

    await this.onEvolution();
    await this.onEnterPlay();
  }

  isDamaged() {
    return this.currentHP < this.maxHP;
  }
  currentDamage() {
    return this.maxHP - this.currentHP;
  }

  applyDamage(HP: number) {
    this.currentHP -= HP;
    if (this.currentHP < 0) this.currentHP = 0;
  }

  /**
   * Heals a set amount of damage from this Pokémon.
   */
  healDamage(HP: number): number {
    if (this.pokemonStatuses.some((s) => s.type === "CannotHeal")) {
      this.logger.effectPrevented(this.player, this);
      return 0;
    }

    const initialHP = this.currentHP;

    this.currentHP += HP;
    if (this.currentHP > this.maxHP) this.currentHP = this.maxHP;

    this.logger.pokemonHealed(this.player, this, initialHP, HP);

    return this.currentHP - initialHP;
  }

  attachEnergy(energy: Energy[]) {
    for (const e of energy) {
      const index = this.attachedEnergy.findIndex(
        (en) => allTypes.indexOf(e) < allTypes.indexOf(en),
      );
      if (index !== -1) {
        this.attachedEnergy.splice(index, 0, e);
      } else {
        this.attachedEnergy.push(e);
      }
    }
  }
  removeEnergy(energy: Energy[]) {
    for (const e of energy) removeElement(this.attachedEnergy, e);
  }

  /**
   * Determines whether this Pokémon has a specific type of Energy attached.
   * - If given a single type, checks if at least one Energy of that type is attached.
   * - If given an array of types, checks if at least one Energy of any of those types is attached.
   * - If no Energy type is specified, checks if any Energy is attached.
   */
  hasAnyEnergy(energy?: Energy | Energy[]) {
    return this.getEnergy(energy).length > 0;
  }
  /**
   * Gets the Energy attached to this Pokémon, optionally filtered to a specific type or array of
   * types.
   */
  getEnergy(energy?: Energy | Energy[]) {
    if (!energy) return this.attachedEnergy.slice();
    if (Array.isArray(energy)) {
      return this.attachedEnergy.filter((e) => energy.includes(e));
    }
    return this.attachedEnergy.filter((e) => e === energy);
  }

  isPoisoned() {
    return this.secondaryConditions.has("Poisoned") || this.secondaryConditions.has("Poisoned+");
  }
  isBurned() {
    return this.secondaryConditions.has("Burned");
  }
  hasSpecialCondition() {
    return this.currentConditions.length > 0;
  }

  /**
   * Recovers this Pokemon from a random Special Condition.
   */
  removeRandomSpecialCondition() {
    const conditions = this.currentConditions;
    if (conditions.length == 0) return;

    const condition = randomElement(conditions);

    if (condition === "Asleep" || condition === "Confused" || condition === "Paralyzed") {
      this.primaryCondition = undefined;
    } else {
      this.secondaryConditions.delete(condition);
    }

    this.logger.specialConditionEnded(this, [condition]);
  }

  /**
   * Recovers this Pokemon from all Special Conditions.
   */
  removeAllSpecialConditions() {
    const conditions = this.currentConditions;
    if (conditions.length == 0) return;

    this.primaryCondition = undefined;
    this.secondaryConditions = new Set();

    this.logger.specialConditionEnded(this, conditions);
  }

  /**
   * Recovers this Pokemon from all Special Conditions and removes all "Effect" PokemonStatuses.
   */
  removeAllSpecialConditionsAndStatuses() {
    this.removeAllSpecialConditions();

    for (const status of this._pokemonStatuses) {
      if (status.source === "Effect") this.removePokemonStatus(status);
    }
  }

  /**
   * Applies a PokemonStatus to this Pokemon and deals with any immediate effects.
   *
   * Applies unconditionally; to check for effect prevention, use Game.applyPokemonStatus().
   */
  applyPokemonStatus(status: PokemonStatus) {
    this.logger.applyPokemonStatus(this.player, this, status);

    if (status.doesNotStack) {
      if (this._pokemonStatuses.some((s) => s.type === status.type && s.doesNotStack)) {
        return;
      }
    }

    this._pokemonStatuses.push(status);

    if (status.type === "IncreaseMaxHP") {
      const hpIncrease = status.amount;
      this.maxHP += hpIncrease;
      this.currentHP += hpIncrease;
    }
  }

  /**
   * Removes a PokemonStatus from this Pokemon and deals with any side effects.
   */
  removePokemonStatus(status: PokemonStatus) {
    removeElement(this._pokemonStatuses, status);
    this.logger.removePokemonStatus(this, status);

    if (status.type === "IncreaseMaxHP") {
      const hpIncrease = status.amount;
      this.maxHP -= hpIncrease;
      this.currentHP -= hpIncrease;
    }
  }

  /**
   * Updates PokemonStatuses at the end of the turn, removing those that should expire.
   */
  updatePokemonStatusesAtTurnEnd() {
    for (const status of this._pokemonStatuses) {
      if (status.turnsToKeep !== undefined) {
        if (status.turnsToKeep > 0) {
          status.turnsToKeep -= 1;
        } else {
          this.removePokemonStatus(status);
        }
      }
    }
  }

  /**
   * Attaches a PokemonTool to this Pokemon and deals with any immediate effects.
   *
   * Does not check if a tool can be attached; that should be done before calling this method.
   */
  async attachPokemonTool(card: PokemonToolCard) {
    this.logger.attachPokemonTool(this.player, card, this);
    this.attachedToolCards.push(card);
    this.inPlayCards.push(card);
    this.player.InPlay.push(card);
  }

  /**
   * Removes a PokemonTool from this Pokemon and deals with any side effects.
   *
   * Removes the card from in play, but does not discard it or return it to the hand.
   */
  async removePokemonTool(card: PokemonToolCard) {
    this.logger.removePokemonTool(this.player, card, this);
    removeElement(this.attachedToolCards, card);
    removeElement(this.inPlayCards, card);
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
    return this.energyIsSufficient(energies, this.effectiveEnergy);
  }
  hasSufficientActualEnergy(energies: Energy[]) {
    return this.energyIsSufficient(energies, this.attachedEnergy);
  }
  findEffectiveAttackCost(attack: Attack): Energy[] {
    let requiredEnergy = [...attack.requiredEnergy];
    if (attack.alternateAttackCost && attack.alternateAttackCost.condition(this.player, this, 0)) {
      requiredEnergy = attack.alternateAttackCost.cost;
    }
    for (const status of this.pokemonStatuses) {
      if (status.type == "ModifyAttackCost") {
        if (status.amount < 0) {
          for (let i = 0; i < -status.amount; i++) {
            if (requiredEnergy.includes(status.energyType))
              removeElement(requiredEnergy, status.energyType);
          }
        } else {
          requiredEnergy.push(...Array(status.amount).fill(status.energyType));
        }
      }
    }
    return requiredEnergy;
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

    if (!ability.conditions.every((condition) => condition(this.player, this, 0))) return;

    if ("optional" in ability.trigger && ability.trigger.optional) {
      const prompt = `Use the effect of ${ability.name}?`;
      const useAbility = await this.player.game.chooseYesNo(this.player, prompt);
      if (!useAbility) return;
    }

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

  async onEvolution() {
    for (const ability of this.effectiveAbilities) {
      if (ability.type === "Standard" && ability.trigger.type === "OnEvolution") {
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
    for (const status of this.pokemonStatuses) {
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
