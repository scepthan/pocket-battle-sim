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

  get BaseCard() {
    return this.self.BaseCard;
  }
  get ID() {
    return this.self.ID;
  }
  get Name() {
    return this.self.Name;
  }
  get Type() {
    return this.self.Type;
  }
  get BaseHP() {
    return this.self.BaseHP;
  }
  get Stage() {
    return this.self.Stage;
  }
  get RetreatCost() {
    return this.self.RetreatCost;
  }
  get Weakness() {
    return this.self.Weakness;
  }
  get PrizePoints() {
    return this.self.PrizePoints;
  }
  get Attacks() {
    return this.self.Attacks;
  }
  get Ability() {
    return this.self.Ability;
  }
  get CurrentHP() {
    return this.self.CurrentHP;
  }
  get MaxHP() {
    return this.self.MaxHP;
  }
  get AttachedEnergy() {
    return this.self.AttachedEnergy;
  }
  get EffectiveEnergy() {
    return this.self.EffectiveEnergy;
  }
  get AttachedToolCards() {
    return this.self.AttachedToolCards;
  }
  get MaxToolCards() {
    return this.self.MaxToolCards;
  }
  get PrimaryCondition() {
    return this.self.PrimaryCondition;
  }
  get SecondaryConditions() {
    return this.self.SecondaryConditions;
  }
  get CurrentConditions() {
    return this.self.CurrentConditions;
  }
  get PokemonStatuses() {
    return this.self.PokemonStatuses;
  }
  get ActivePlayerStatuses() {
    return this.self.ActivePlayerStatuses;
  }
  get InPlayCards() {
    return this.self.InPlayCards;
  }
  get ReadyToEvolve() {
    return this.self.ReadyToEvolve;
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
