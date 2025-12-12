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
import { InPlayPokemon } from "./InPlayPokemon";
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

  ActivePokemon: InPlayPokemon | EmptyCardSlot; // The active Pokémon card (EmptyCardSlot during setup phase and when active is knocked out)
  Bench: (InPlayPokemon | EmptyCardSlot)[]; // Pokémon cards on the bench, EmptyCardSlot if no Pokémon is in a slot
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
  pokemonToDescriptor(pokemon: InPlayPokemon): InPlayPokemonDescriptor {
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

  canDraw(usingCard: boolean = false) {
    return this.Deck.length > 0 && this.Hand.length - +usingCard < this.game.GameRules.MaxHandSize;
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

  changeNextEnergy(newEnergy: Energy) {
    this.NextEnergy = newEnergy;
    this.logger.changeNextEnergy(this);
  }

  async setupPokemon(setup: PlayerGameSetup) {
    // Set up the active Pokémon
    if (!this.Hand.includes(setup.active)) {
      throw new Error("Card not in hand");
    }
    if (setup.active.Stage != 0) {
      throw new Error("Can only play Basic Pokemon at game start");
    }

    const pokemon = new InPlayPokemon(this, setup.active);
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

  shuffleHandIntoDeckAndDraw(count: number) {
    this.shuffleHandIntoDeck();
    this.drawCards(count);
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

  pullRandomCard(cards: PlayingCard[], predicate: (card: PlayingCard) => boolean) {
    const filteredCards = cards.filter(predicate);
    if (filteredCards.length > 0) {
      const card = randomElement(filteredCards);
      removeElement(cards, card);
      return card;
    } else {
      this.logger.noValidCards(this);
    }
  }

  drawRandomFilteredToHand(predicate: (card: PlayingCard) => boolean) {
    const card = this.pullRandomCard(this.Deck, predicate);
    if (!card) return;
    this.Hand.push(card);
    this.logger.drawRandomFiltered(this, card);

    this.shuffleDeck();

    return card;
  }

  async playRandomFilteredToBench(predicate: (card: PlayingCard) => boolean) {
    const benchIndex = this.Bench.findIndex((slot) => !slot.isPokemon);
    if (this.BenchedPokemon.length >= 3) {
      this.logger.benchFull(this);
      return;
    }

    const card = this.pullRandomCard(this.Deck, predicate);
    if (!card) return;
    await this.putPokemonOnBench(card as PokemonCard, benchIndex);

    this.shuffleDeck();

    return card;
  }

  discardRandomFiltered(predicate: (card: PlayingCard) => boolean = () => true) {
    const card = this.pullRandomCard(this.Hand, predicate);
    if (!card) return [];
    this.Discard.push(card);
    this.logger.discardFromHand(this, [card]);

    return [card];
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
  async setNewActivePokemon(pokemon: InPlayPokemon) {
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

    const pokemon = new InPlayPokemon(this, card, trueCard);
    this.Bench[index] = pokemon;
    this.InPlay.push(trueCard);
    // Needs to be optional because fossils are currently removed from hand before this method is called
    if (this.Hand.includes(trueCard)) {
      removeElement(this.Hand, trueCard);
    }

    this.logger.playToBench(this, card, index);

    await pokemon.onEnterPlay();
  }

  async evolvePokemon(pokemon: InPlayPokemon, card: PokemonCard, skipStage1: boolean = false) {
    if (!this.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.EvolvesFrom != pokemon.Name && !skipStage1) {
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

    pokemon.removeAllSpecialConditionsAndStatuses();

    await pokemon.onEnterPlay();
  }

  canAttachFromEnergyZone(pokemon: InPlayPokemon) {
    if (
      this.PlayerStatuses.some(
        (status) =>
          status.type === "CannotAttachFromEnergyZone" &&
          status.appliesToPokemon(pokemon, this.game)
      )
    )
      return false;

    return true;
  }

  async attachAvailableEnergy(pokemon: InPlayPokemon) {
    if (!this.AvailableEnergy) {
      throw new Error("No energy available to attach");
    }
    await this.attachEnergy(pokemon, [this.AvailableEnergy], "turn");
    this.AvailableEnergy = undefined;
  }

  async attachEnergy(
    pokemon: InPlayPokemon,
    energy: Energy[],
    from: AttachEnergySource,
    fromPokemon?: InPlayPokemon
  ) {
    if ((from === "turn" || from === "energyZone") && !this.canAttachFromEnergyZone(pokemon)) {
      // Log prevention?
      return;
    }

    pokemon.attachEnergy(energy);
    this.logger.attachEnergy(this, pokemon, energy, from, fromPokemon);
    if (from === "turn" || from === "energyZone") await pokemon.onEnergyZoneAttach(energy);
  }

  async transferEnergy(fromPokemon: InPlayPokemon, toPokemon: InPlayPokemon, energy: Energy[]) {
    if (!fromPokemon.hasSufficientActualEnergy(energy))
      throw new Error("Energy not attached to fromPokemon");

    fromPokemon.removeEnergy(energy);
    toPokemon.attachEnergy(energy);
    this.logger.attachEnergy(this, toPokemon, energy, "pokemon", fromPokemon);
  }

  async discardEnergyFromPokemon(pokemon: InPlayPokemon, type: Energy, count: number = 1) {
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
  async discardAllEnergyFromPokemon(pokemon: InPlayPokemon) {
    const discardedEnergy = pokemon.AttachedEnergy.slice();

    pokemon.removeEnergy(discardedEnergy);
    this.discardEnergy(discardedEnergy, "effect", pokemon);
  }
  async discardRandomEnergyFromPokemon(pokemon: InPlayPokemon, count: number = 1) {
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
  discardEnergy(energies: Energy[], source: DiscardEnergySource, pokemon?: InPlayPokemon) {
    if (energies.length == 0) return;

    this.DiscardedEnergy.push(...energies);
    this.logger.discardEnergy(this, energies, source, pokemon);
  }

  activeOrThrow(): InPlayPokemon {
    if (!this.ActivePokemon.isPokemon) {
      throw new Error("No active Pokemon");
    }
    return this.ActivePokemon;
  }

  get effectiveRetreatCost(): number {
    const active = this.activeOrThrow();
    let retreatCost = active.RetreatCost;

    for (const status of this.PlayerStatuses) {
      if (status.type === "NoRetreatCost" && status.appliesToPokemon(active, this.game)) {
        return 0;
      }
      if (status.type === "DecreaseRetreatCost" && status.appliesToPokemon(active, this.game)) {
        retreatCost -= status.amount;
      }
    }

    for (const status of active.PokemonStatuses) {
      if (status.type === "NoRetreatCost") {
        return 0;
      }
    }

    if (retreatCost < 0) retreatCost = 0;
    return retreatCost;
  }

  async retreatActivePokemon(newActive: InPlayPokemon, energyToDiscard: Energy[]) {
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

    const effectiveEnergyToDiscard = currentActive.calculateEffectiveEnergy(energyToDiscard);
    if (this.effectiveRetreatCost > effectiveEnergyToDiscard.length)
      throw new Error("Not enough energy provided");

    currentActive.removeEnergy(energyToDiscard);
    this.discardEnergy(energyToDiscard, "retreat", currentActive);

    await this.swapActivePokemon(newActive, "retreat");
  }

  async swapActivePokemon(
    newActive: InPlayPokemon,
    reason: "retreat" | "selfEffect" | "opponentEffect",
    choosingPlayer?: string
  ) {
    const currentActive = this.activeOrThrow();

    this.ActivePokemon = newActive;
    this.Bench[this.Bench.indexOf(newActive)] = currentActive;

    this.logger.swapActivePokemon(this, currentActive, newActive, reason, choosingPlayer);

    currentActive.removeAllSpecialConditionsAndStatuses();
  }

  async removePokemonFromField(pokemon: InPlayPokemon) {
    if (pokemon == this.ActivePokemon) {
      this.ActivePokemon = EmptyCardSlot.Active();
    } else {
      const index = this.Bench.indexOf(pokemon);
      this.Bench[index] = EmptyCardSlot.Bench(index);
    }
  }

  async returnPokemonToHand(pokemon: InPlayPokemon) {
    await this.removePokemonFromField(pokemon);

    const discardedCards: PlayingCard[] = [];
    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      if (card.CardType == "PokemonTool") {
        this.Discard.push(card);
        discardedCards.push(card);
      } else {
        this.Hand.push(card);
      }
    }

    this.logger.returnInPlayPokemonToHand(this, pokemon);
    if (discardedCards.length > 0) this.logger.discardFromPlay(this, discardedCards);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  async shufflePokemonIntoDeck(pokemon: InPlayPokemon) {
    await this.removePokemonFromField(pokemon);

    const discardedCards: PlayingCard[] = [];
    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      if (card.CardType == "PokemonTool") {
        this.Discard.push(card);
        discardedCards.push(card);
      } else {
        this.Deck.push(card);
      }
    }

    this.logger.returnInPlayPokemonToDeck(this, pokemon);
    if (discardedCards.length > 0) this.logger.discardFromPlay(this, discardedCards);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");

    this.shuffleDeck();
  }

  async discardPokemonFromPlay(pokemon: InPlayPokemon) {
    await this.removePokemonFromField(pokemon);

    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      this.Discard.push(card);
    }

    this.logger.discardFromPlay(this, pokemon.InPlayCards);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  async handleKnockOut(pokemon: InPlayPokemon, fromAttack: boolean) {
    this.logger.pokemonKnockedOut(this, pokemon, fromAttack);

    if (fromAttack) await pokemon.afterKnockedOutByAttack();

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

  shouldPreventSpecialConditions(pokemon: InPlayPokemon): boolean {
    const result = pokemon.PokemonStatuses.some(
      (status) => status.type === "PreventSpecialConditions"
    );
    if (result) this.logger.specialConditionPrevented(this, pokemon);
    return result;
  }

  poisonActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().SecondaryConditions.add("Poisoned");
    this.activeOrThrow().SecondaryConditions.delete("Poisoned+");
    this.logger.specialConditionApplied(this, "Poisoned");
  }
  poisonPlusActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().SecondaryConditions.add("Poisoned+");
    this.activeOrThrow().SecondaryConditions.delete("Poisoned");
    this.logger.specialConditionApplied(this, "Poisoned");
  }
  burnActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().SecondaryConditions.add("Burned");
    this.logger.specialConditionApplied(this, "Burned");
  }
  sleepActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().PrimaryCondition = "Asleep";
    this.logger.specialConditionApplied(this, "Asleep");
  }
  paralyzeActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().PrimaryCondition = "Paralyzed";
    this.logger.specialConditionApplied(this, "Paralyzed");
  }
  confuseActivePokemon() {
    if (this.shouldPreventSpecialConditions(this.activeOrThrow())) return;
    this.activeOrThrow().PrimaryCondition = "Confused";
    this.logger.specialConditionApplied(this, "Confused");
  }

  applyActivePokemonStatus(status: PokemonStatus) {
    this.activeOrThrow().applyPokemonStatus(status);
  }

  applyPlayerStatus(status: PlayerStatus, pokemon?: InPlayPokemon) {
    if (status.source === "Ability") {
      if (status.id?.length === 36) status.id += this.Name;

      const existingStatus = this.PlayerStatuses.find((s) => s.id === status.id);
      if (existingStatus) {
        if (pokemon) pokemon.ActivePlayerStatuses.push(existingStatus);
        return;
      }
    }

    if (!status.id) status.id = uuidv4();

    this.PlayerStatuses.push(status);
    this.logger.applyPlayerStatus(this, status);

    if (pokemon) pokemon.ActivePlayerStatuses.push(status);
  }
  removePlayerStatus(statusId: string) {
    const status = this.PlayerStatuses.find((s) => s.id === statusId);
    if (!status) return;

    if (status.source === "Ability") {
      const otherPokemonWithStatus = this.InPlayPokemon.filter((p) =>
        p.ActivePlayerStatuses.some((s) => s.id === statusId)
      );
      if (otherPokemonWithStatus.length > 0) return;
    }

    removeElement(this.PlayerStatuses, status);
    this.logger.removePlayerStatus(this, status);
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
