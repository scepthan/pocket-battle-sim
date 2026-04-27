import type { InPlayPokemon } from "./InPlayPokemon";
import type { Energy } from "./types";

export class PlayerPokemonView {
  private self: InPlayPokemon;

  isPokemon = true as const;

  constructor(pokemon: InPlayPokemon) {
    this.self = pokemon;
  }

  is(pokemon: InPlayPokemon) {
    return pokemon === this.self;
  }

  get location() {
    return this.self.location;
  }
  get benchIndex() {
    return this.self.benchIndex;
  }

  get cardId() {
    return this.self.cardId;
  }
  get name() {
    return this.self.name;
  }
  get illustrationUrl() {
    return this.self.baseCard.illustrationUrl;
  }
  get evolvesAs() {
    return this.self.evolvesAs;
  }
  get type() {
    return this.self.type;
  }
  get baseHP() {
    return this.self.baseHP;
  }
  get stage() {
    return this.self.stage;
  }
  get retreatCost() {
    return this.self.retreatCost;
  }
  get weakness() {
    return this.self.weakness;
  }
  get prizePoints() {
    return this.self.prizePoints;
  }
  get attacks() {
    return this.self.attacks;
  }
  get ability() {
    return this.self.ability;
  }
  get currentHP() {
    return this.self.currentHP;
  }
  get maxHP() {
    return this.self.maxHP;
  }
  get attachedEnergy() {
    return this.self.attachedEnergy;
  }
  get effectiveEnergy() {
    return this.self.effectiveEnergy;
  }
  get attachedToolCards() {
    return this.self.attachedToolCards;
  }
  get maxToolCards() {
    return this.self.maxToolCards;
  }
  get primaryCondition() {
    return this.self.primaryCondition;
  }
  get secondaryConditions() {
    return this.self.secondaryConditions;
  }
  get currentConditions() {
    return this.self.currentConditions;
  }
  get pokemonStatuses() {
    return this.self.pokemonStatuses;
  }
  get activePlayerStatuses() {
    return this.self.activePlayerStatuses;
  }
  get inPlayCards() {
    return this.self.inPlayCards;
  }
  get readyToEvolve() {
    return !this.self.playedThisTurn;
  }

  calculateEffectiveEnergy(energies: Energy[]): Energy[] {
    return this.self.calculateEffectiveEnergy(energies);
  }
  hasSufficientEnergy(energies: Energy[]): boolean {
    return this.self.hasSufficientEnergy(energies);
  }
  isDamaged(): boolean {
    return this.self.isDamaged();
  }
}
