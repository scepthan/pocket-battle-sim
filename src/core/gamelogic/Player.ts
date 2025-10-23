import { v4 as uuidv4 } from "uuid";
import type {
  AttachEnergySource,
  DiscardEnergySource,
  GameLogger,
  InPlayPokemonDescriptor,
} from "../logging";
import { randomElement, removeElement } from "../util";
import { CoinFlipper } from "./CoinFlipper";
import { EmptyCardSlot } from "./EmptyCardSlot";
import type { Game } from "./Game";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type {
  Deck,
  Energy,
  PlayerGameSetup,
  PlayerStatus,
  PlayingCard,
  PokemonCard,
  PokemonStatus,
} from "./types";

export class Player {
  Name: string;
  EnergyTypes: Energy[]; // The types of energy available in the player's deck
  Deck: PlayingCard[]; // The player's deck of cards, initially set from the provided deck
  Hand: PlayingCard[] = []; // Cards in the player's hand
  InPlay: PlayingCard[] = []; // Cards that are currently in play (active or benched Pokémon)
  Discard: PlayingCard[] = []; // Cards that have been discarded during the game
  DiscardedEnergy: Energy[] = []; // Energy that has been discarded during the game
  GamePoints: number = 0; // The number of prize cards the player has taken (for winning the game)

  ActivePokemon: InPlayPokemonCard | EmptyCardSlot; // The active Pokémon card (EmptyCardSlot during setup phase and when active is knocked out)
  Bench: (InPlayPokemonCard | EmptyCardSlot)[]; // Pokémon cards on the bench, EmptyCardSlot if no Pokémon is in a slot
  AvailableEnergy?: Energy; // The energy type available for use this turn, if any (not used in all game modes)
  NextEnergy: Energy = "Colorless"; // The next energy type to be used for attaching to Pokémon, set when the game starts
  PlayerStatuses: PlayerStatus[] = []; // Status effects that apply to the player (e.g., cannot play supporter cards)

  game: Game;
  logger: GameLogger;
  private flipper: CoinFlipper;

  get InPlayPokemon() {
    return [this.ActivePokemon, ...this.Bench].filter((x) => x.isPokemon);
  }
  get BenchedPokemon() {
    return this.Bench.filter((x) => x.isPokemon);
  }
  get opponent() {
    return this === this.game.Player1 ? this.game.Player2 : this.game.Player1;
  }

  constructor(name: string, deck: Deck, game: Game) {
    this.Name = name;
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = deck.Cards;
    this.game = game;
    this.logger = game.GameLog;
    this.flipper = new CoinFlipper(this);

    this.ActivePokemon = EmptyCardSlot.Active();
    this.Bench = [];
    for (let i = 0; i < 3; i++) {
      this.Bench.push(EmptyCardSlot.Bench(i));
    }
  }

  // Helper methods
  pokemonToDescriptor(pokemon: InPlayPokemonCard): InPlayPokemonDescriptor {
    if (pokemon == this.ActivePokemon) {
      return {
        cardId: pokemon.ID,
        location: "active",
      };
    } else {
      return {
        cardId: pokemon.ID,
        location: "bench",
        index: this.Bench.indexOf(pokemon),
      };
    }
  }

  canDraw() {
    return this.Deck.length > 0 && this.Hand.length < this.game.GameRules.MaxHandSize;
  }

  hasBasicPokemon() {
    return this.Hand.some((card) => card.CardType == "Pokemon" && card.Stage == 0);
  }

  // Setup methods
  setup(handSize: number) {
    this.drawInitialHand(handSize);

    this.chooseNextEnergy();
  }

  chooseNextEnergy() {
    this.NextEnergy = randomElement(this.EnergyTypes);
    this.logger.generateNextEnergy(this);
  }

  async setupPokemon(setup: PlayerGameSetup) {
    // Set up the active Pokémon
    if (!this.Hand.includes(setup.active)) {
      throw new Error("Card not in hand");
    }
    if (setup.active.Stage != 0) {
      throw new Error("Can only play Basic Pokemon at game start");
    }

    const pokemon = new InPlayPokemonCard(this, setup.active);
    this.ActivePokemon = pokemon;
    this.InPlay.push(setup.active);
    removeElement(this.Hand, setup.active);

    this.logger.playToActive(this, setup.active);

    if (
      pokemon.Ability?.type === "Standard" &&
      pokemon.Ability.trigger.type === "OnEnterPlay" &&
      !pokemon.Ability.trigger.excludeSetup
    ) {
      await pokemon.triggerAbility();
    }

    // Set up the bench Pokémon
    for (const i in setup.bench) {
      const card = setup.bench[i];
      if (!card) return;
      await this.putPokemonOnBench(card, +i);
    }
  }

  reset() {
    this.ActivePokemon = EmptyCardSlot.Active();
    this.Bench = [];
    for (let i = 0; i < 3; i++) {
      this.Bench.push(EmptyCardSlot.Bench(i));
    }

    this.Deck = this.Deck.concat(this.Hand, this.InPlay, this.Discard);
    this.Hand = [];
    this.InPlay = [];
    this.Discard = [];
    this.shuffleDeck(false);
  }

  drawInitialHand(handSize: number) {
    this.reset();

    while (true) {
      this.drawCards(handSize, false);
      if (this.hasBasicPokemon()) {
        break;
      }
      this.shuffleHandIntoDeck(false);
    }

    this.logger.drawToHand(this, handSize, this.Hand);
  }

  // Drawing-related methods
  shuffleDeck(log: boolean = true) {
    const newDeck: PlayingCard[] = [];

    for (const card of this.Deck) {
      const insertIndex = Math.floor(Math.random() * (newDeck.length + 1));
      newDeck.splice(insertIndex, 0, card);
    }

    this.Deck = newDeck;

    if (log) this.logger.shuffleDeck(this);
  }

  shuffleHandIntoDeck(log: boolean = true) {
    if (log) this.logger.returnHandToDeck(this, this.Hand);

    this.Deck = this.Deck.concat(this.Hand);
    this.Hand = [];
    this.shuffleDeck(log);
  }

  drawCards(count: number, log: boolean = true) {
    const cardsDrawn: PlayingCard[] = [];
    while (cardsDrawn.length < count) {
      if (this.Deck.length == 0 || this.Hand.length >= this.game.GameRules.MaxHandSize) break;

      cardsDrawn.push(this.Deck.shift()!);
    }
    if (log) this.logger.drawToHand(this, count, cardsDrawn);

    this.Hand.push(...cardsDrawn);
  }

  drawRandomFiltered(predicate: (card: PlayingCard) => boolean) {
    const filteredCards = this.Deck.filter(predicate);
    let card = undefined;
    if (filteredCards.length > 0) {
      card = randomElement(filteredCards);
      removeElement(this.Deck, card);
      this.Hand.push(card);
    }

    this.logger.drawRandomFiltered(this, card);

    this.shuffleDeck();

    return card;
  }

  discardRandomFiltered(predicate: (card: PlayingCard) => boolean = () => true) {
    const filteredCards = this.Hand.filter(predicate);
    const discarded: PlayingCard[] = [];
    if (filteredCards.length > 0) {
      const card = randomElement(filteredCards);
      discarded.push(card);
      removeElement(this.Hand, card);
      this.Discard.push(card);
    }

    this.logger.discardFromHand(this, discarded);

    return discarded;
  }

  returnToDeck(cards: PlayingCard[]) {
    cards = cards.filter((card) => this.Hand.includes(card));
    if (cards.length == 0) return;

    this.logger.returnToDeck(this, cards, "hand");
    this.Hand = this.Hand.filter((card) => !cards.includes(card));
    this.Deck.push(...cards);

    this.shuffleDeck();
  }

  // Methods for moving and evolving Pokémon

  /**
   * Sets the new Active Pokémon when the previous one is removed from play.
   */
  async setNewActivePokemon(pokemon: InPlayPokemonCard) {
    if (!this.Bench.includes(pokemon)) {
      throw new Error("Pokemon not on bench");
    }
    this.ActivePokemon = pokemon;
    const index = this.Bench.indexOf(pokemon);
    this.Bench[index] = EmptyCardSlot.Bench(index);

    this.logger.selectActivePokemon(this);
  }

  async putPokemonOnBench(card: PokemonCard, index: number, trueCard: PlayingCard = card) {
    if (!this.Bench[index]) {
      throw new Error("Invalid bench index specified");
    }
    if (this.Bench[index].isPokemon) {
      throw new Error("Bench already has a Pokemon in this slot");
    }
    if (card.Stage != 0) {
      throw new Error("Can only play Basic Pokemon to bench");
    }

    const pokemon = new InPlayPokemonCard(this, card, trueCard);
    this.Bench[index] = pokemon;
    this.InPlay.push(trueCard);
    // Needs to be optional because fossils are currently removed from hand before this method is called
    if (this.Hand.includes(trueCard)) {
      removeElement(this.Hand, trueCard);
    }

    this.logger.playToBench(this, card, index);

    await pokemon.onEnterPlay();
  }

  async evolvePokemon(pokemon: InPlayPokemonCard, card: PokemonCard) {
    if (!this.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.EvolvesFrom != pokemon.Name) {
      throw new Error("Card does not evolve from this Pokemon");
    }
    if (!pokemon.ReadyToEvolve) {
      throw new Error("Pokemon is not ready to evolve");
    }
    if (
      this.PlayerStatuses.some(
        (status) => status.type == "CannotEvolve" && status.appliesToPokemon(pokemon, this.game)
      )
    ) {
      throw new Error("Cannot evolve this Pokemon due to status effect");
    }

    removeElement(this.Hand, card);
    this.InPlay.push(card);

    this.logger.evolvePokemon(this, pokemon, card);
    pokemon.evolveInto(card);

    pokemon.recoverAllStatusConditions();

    await pokemon.onEnterPlay();
  }

  async attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.AvailableEnergy) {
      throw new Error("No energy available to attach");
    }
    await this.attachEnergy(pokemon, [this.AvailableEnergy], "player");
    this.AvailableEnergy = undefined;
  }

  async attachEnergy(
    pokemon: InPlayPokemonCard,
    energy: Energy[],
    from: AttachEnergySource,
    fromPokemon?: InPlayPokemonCard
  ) {
    pokemon.attachEnergy(energy);
    this.logger.attachEnergy(this, pokemon, energy, from, fromPokemon);
  }

  async transferEnergy(
    fromPokemon: InPlayPokemonCard,
    toPokemon: InPlayPokemonCard,
    energy: Energy[]
  ) {
    if (!fromPokemon.hasSufficientActualEnergy(energy))
      throw new Error("Energy not attached to fromPokemon");

    fromPokemon.removeEnergy(energy);
    toPokemon.attachEnergy(energy);
    this.logger.attachEnergy(this, toPokemon, energy, "pokemon", fromPokemon);
  }

  async discardEnergyFromPokemon(pokemon: InPlayPokemonCard, type: Energy, count: number = 1) {
    const discardedEnergy: Energy[] = [];
    const remainingEnergy = pokemon.AttachedEnergy.slice();
    while (remainingEnergy.includes(type) && count > 0) {
      discardedEnergy.push(type);
      removeElement(remainingEnergy, type);
      count -= 1;
    }

    pokemon.removeEnergy(discardedEnergy);
    this.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  async discardAllEnergyFromPokemon(pokemon: InPlayPokemonCard) {
    const discardedEnergy = pokemon.AttachedEnergy.slice();

    pokemon.removeEnergy(discardedEnergy);
    this.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  async discardRandomEnergyFromPokemon(pokemon: InPlayPokemonCard, count: number = 1) {
    if (pokemon.AttachedEnergy.length == 0) return;

    const discardedEnergy: Energy[] = [];
    const remainingEnergy = pokemon.AttachedEnergy.slice();

    while (remainingEnergy.length > 0 && count > 0) {
      const energy = randomElement(remainingEnergy);
      discardedEnergy.push(energy);
      removeElement(remainingEnergy, energy);
      count -= 1;
    }

    pokemon.removeEnergy(discardedEnergy);
    this.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  discardEnergy(energies: Energy[], source: DiscardEnergySource, pokemon?: InPlayPokemonCard) {
    if (energies.length == 0) return;

    this.DiscardedEnergy.push(...energies);
    this.logger.discardEnergy(this, energies, source, pokemon);
  }

  activeOrThrow(): InPlayPokemonCard {
    if (!this.ActivePokemon.isPokemon) {
      throw new Error("No active Pokemon");
    }
    return this.ActivePokemon;
  }

  async retreatActivePokemon(newActive: InPlayPokemonCard, energyToDiscard: Energy[]) {
    const currentActive = this.activeOrThrow();
    if (currentActive.RetreatCost == -1) {
      throw new Error("This Pokémon cannot retreat");
    }
    if (
      currentActive.PrimaryCondition == "Asleep" ||
      currentActive.PrimaryCondition == "Paralyzed"
    ) {
      throw new Error("Cannot retreat while " + currentActive.PrimaryCondition);
    }
    if (!currentActive.hasSufficientActualEnergy(energyToDiscard)) {
      throw new Error("Energy not attached to active Pokemon");
    }

    let modifiedCost = currentActive.RetreatCost;
    for (const status of this.PlayerStatuses) {
      if (status.type === "DecreaseRetreatCost") modifiedCost -= status.amount;
    }
    if (modifiedCost < 0) modifiedCost = 0;

    const effectiveEnergyToDiscard = currentActive.calculateEffectiveEnergy(energyToDiscard);
    if (modifiedCost > effectiveEnergyToDiscard.length)
      throw new Error("Not enough energy provided");

    currentActive.removeEnergy(energyToDiscard);
    this.discardEnergy(energyToDiscard, "retreat", currentActive);

    await this.swapActivePokemon(newActive, "retreat");
  }

  async swapActivePokemon(
    newActive: InPlayPokemonCard,
    reason: "retreat" | "selfEffect" | "opponentEffect",
    choosingPlayer?: string
  ) {
    const currentActive = this.activeOrThrow();

    this.ActivePokemon = newActive;
    this.Bench[this.Bench.indexOf(newActive)] = currentActive;

    this.logger.swapActivePokemon(this, currentActive, newActive, reason, choosingPlayer);

    currentActive.recoverAllStatusConditions();
  }

  async removePokemonFromField(pokemon: InPlayPokemonCard) {
    if (pokemon == this.ActivePokemon) {
      this.ActivePokemon = EmptyCardSlot.Active();
    } else {
      const index = this.Bench.indexOf(pokemon);
      this.Bench[index] = EmptyCardSlot.Bench(index);
    }
  }

  async returnPokemonToHand(pokemon: InPlayPokemonCard) {
    await this.removePokemonFromField(pokemon);

    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      this.Hand.push(card);
    }

    this.logger.returnInPlayPokemonToHand(this, pokemon);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  async shufflePokemonIntoDeck(pokemon: InPlayPokemonCard) {
    await this.removePokemonFromField(pokemon);

    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      this.Deck.push(card);
    }

    this.logger.returnInPlayPokemonToDeck(this, pokemon);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");

    this.shuffleDeck();
  }

  async discardPokemonFromPlay(pokemon: InPlayPokemonCard) {
    await this.removePokemonFromField(pokemon);

    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      this.Discard.push(card);
    }

    this.logger.discardFromPlay(this, pokemon.InPlayCards);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  async handleKnockOut(pokemon: InPlayPokemonCard, fromAttack: boolean) {
    this.logger.pokemonKnockedOut(this, pokemon, fromAttack);

    for (const card of pokemon.InPlayCards) {
      if (!this.InPlay.includes(card)) throw new Error("Card not in play");
      removeElement(this.InPlay, card);
      this.Discard.push(card);
    }
    this.logger.discardFromPlay(this, pokemon.InPlayCards);

    this.discardEnergy(pokemon.AttachedEnergy, "knockOut");

    await this.removePokemonFromField(pokemon);
  }

  checkPrizePointsChange(previousPoints: number) {
    if (this.GamePoints > previousPoints) {
      this.logger.scorePrizePoints(this, this.GamePoints - previousPoints);
    }
  }

  discardCardsFromHand(cards: PlayingCard[]) {
    cards = cards.filter((card) => this.Hand.includes(card));
    if (cards.length == 0) return;

    this.Hand = this.Hand.filter((card) => !cards.includes(card));
    this.Discard.push(...cards);
    this.logger.discardFromHand(this, cards);
  }
  discardTopOfDeck(count: number) {
    const discarded = this.Deck.splice(0, count);
    if (discarded.length == 0) return;

    this.Discard.push(...discarded);
    this.logger.discardFromDeck(this, discarded);
  }

  poisonActivePokemon() {
    this.activeOrThrow().SecondaryConditions.add("Poisoned");
    this.logger.specialConditionApplied(this, "Poisoned");
  }
  burnActivePokemon() {
    this.activeOrThrow().SecondaryConditions.add("Burned");
    this.logger.specialConditionApplied(this, "Burned");
  }
  sleepActivePokemon() {
    this.activeOrThrow().PrimaryCondition = "Asleep";
    this.logger.specialConditionApplied(this, "Asleep");
  }
  paralyzeActivePokemon() {
    this.activeOrThrow().PrimaryCondition = "Paralyzed";
    this.logger.specialConditionApplied(this, "Paralyzed");
  }
  confuseActivePokemon() {
    this.activeOrThrow().PrimaryCondition = "Confused";
    this.logger.specialConditionApplied(this, "Confused");
  }

  applyActivePokemonStatus(status: PokemonStatus) {
    this.activeOrThrow().applyPokemonStatus(status);
  }

  applyPlayerStatus(status: PlayerStatus, pokemon?: InPlayPokemonCard) {
    if (status.source === "Ability" && status.doesNotStack) {
      const existingStatus = this.PlayerStatuses.find(
        (s) => s.type === status.type && s.source === "Ability"
      );
      if (existingStatus) return existingStatus;
    }

    const newStatus = Object.assign({}, status);
    if (!newStatus.id) newStatus.id = uuidv4();
    if (this.PlayerStatuses.some((s) => s.id === newStatus.id))
      throw new Error("Status has already been applied to this player");

    this.PlayerStatuses.push(newStatus);
    this.logger.applyPlayerStatus(this, newStatus);

    if (pokemon) pokemon.ActivePlayerStatuses.push(newStatus);
  }
  removePlayerStatus(statusId: string) {
    const status = this.PlayerStatuses.find((s) => s.id === statusId);
    if (!status) return;

    if (status.source === "Ability" && status.doesNotStack) {
      const otherPokemonWithStatus = this.InPlayPokemon.filter((p) =>
        p.ActivePlayerStatuses.some((s) => s.id === statusId)
      );
      if (otherPokemonWithStatus.length > 0) return;
    }

    this.PlayerStatuses = this.PlayerStatuses.filter((s) => s.id !== statusId);
    //this.logger.removePlayerStatus(this, status);
  }

  flipCoin() {
    return this.flipper.singleCoinFlip();
  }
  flipMultiCoins(coins: number) {
    return this.flipper.multiCoinFlip(coins);
  }
  flipUntilTails() {
    return this.flipper.untilTailsCoinFlip();
  }
}
