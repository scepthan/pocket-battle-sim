import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "./types";

export class PlayerPokemonView {
  #self: InPlayPokemonCard;

  isPokemon = true as const;

  constructor(pokemon: InPlayPokemonCard) {
    this.#self = pokemon;
  }

  is(pokemon: InPlayPokemonCard) {
    return pokemon === this.#self;
  }

  get ID() {
    return this.#self.ID;
  }
  get Name() {
    return this.#self.Name;
  }
  get Type() {
    return this.#self.Type;
  }
  get BaseHP() {
    return this.#self.BaseHP;
  }
  get Stage() {
    return this.#self.Stage;
  }
  get RetreatCost() {
    return this.#self.RetreatCost;
  }
  get Weakness() {
    return this.#self.Weakness;
  }
  get PrizePoints() {
    return this.#self.PrizePoints;
  }
  get Attacks() {
    return this.#self.Attacks;
  }
  get Ability() {
    return this.#self.Ability;
  }
  get CurrentHP() {
    return this.#self.CurrentHP;
  }
  get MaxHP() {
    return this.#self.MaxHP;
  }
  get AttachedEnergy() {
    return this.#self.AttachedEnergy;
  }
  get EffectiveEnergy() {
    return this.#self.EffectiveEnergy;
  }
  get PrimaryCondition() {
    return this.#self.PrimaryCondition;
  }
  get SecondaryConditions() {
    return this.#self.SecondaryConditions;
  }
  get CurrentConditions() {
    return this.#self.CurrentConditions;
  }
  get PokemonStatuses() {
    return this.#self.PokemonStatuses;
  }
  get ActivePlayerStatuses() {
    return this.#self.ActivePlayerStatuses;
  }
  get InPlayCards() {
    return this.#self.InPlayCards;
  }
  get ReadyToEvolve() {
    return this.#self.ReadyToEvolve;
  }

  hasSufficientEnergy(energies: Energy[]) {
    return this.#self.hasSufficientEnergy(energies);
  }
  isDamaged() {
    return this.#self.isDamaged();
  }
}
