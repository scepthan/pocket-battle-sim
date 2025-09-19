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

  setup(handSize: number) {
    this.drawInitialHand(handSize);

    this.chooseNextEnergy();
    this.logger.generateNextEnergy(this);
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
      this.drawCards(handSize, handSize, false);
      if (this.hasBasicPokemon()) {
        break;
      }
      this.shuffleHandIntoDeck(false);
    }

    this.logger.drawToHand(this, handSize, this.Hand);
  }

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

  canDraw() {
    return this.Deck.length > 0 && this.Hand.length < this.game.GameRules.MaxHandSize;
  }

  drawCards(count: number, maxHandSize: number, log: boolean = true) {
    const cardsDrawn: PlayingCard[] = [];
    while (cardsDrawn.length < count) {
      if (this.Deck.length == 0 || this.Hand.length >= maxHandSize) break;

      cardsDrawn.push(this.Deck.shift()!);
    }
    if (log) this.logger.drawToHand(this, count, cardsDrawn);

    this.Hand.push(...cardsDrawn);
  }

  chooseNextEnergy() {
    this.NextEnergy = randomElement(this.EnergyTypes);
  }

  hasBasicPokemon() {
    return this.Hand.some((card) => card.CardType == "Pokemon" && card.Stage == 0);
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

    if (pokemon.Ability?.Trigger == "OnEnterPlay") {
      await this.triggerAbility(pokemon);
    }

    // Set up the bench Pokémon
    for (const i in setup.bench) {
      const card = setup.bench[i];
      if (!card) return;
      await this.putPokemonOnBench(card, +i);
    }
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

  async setNewActivePokemon(pokemon: InPlayPokemonCard) {
    if (!this.Bench.includes(pokemon)) {
      throw new Error("Pokemon not on bench");
    }
    this.ActivePokemon = pokemon;
    const index = this.Bench.indexOf(pokemon);
    this.Bench[index] = EmptyCardSlot.Bench(index);

    this.logger.selectActivePokemon(this);
    await pokemon.onEnterActive(this.game);
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

    await pokemon.onEnterPlay(this.game);
    await pokemon.onEnterBench(this.game);
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

    this.recoverAllSpecialConditions(pokemon);

    await pokemon.onEnterPlay(this.game);
    if (pokemon === this.ActivePokemon) await pokemon.onEnterActive(this.game);
    else await pokemon.onEnterBench(this.game);
  }

  async triggerAbility(pokemon: InPlayPokemonCard) {
    if (!pokemon.Ability) {
      throw new Error("Pokemon has no ability");
    }

    this.logger.triggerAbility(this, pokemon, pokemon.Ability.Name);
    await pokemon.Ability.Effect(this.game, pokemon);
  }

  attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.AvailableEnergy) {
      throw new Error("No energy available to attach");
    }
    this.attachEnergy(pokemon, [this.AvailableEnergy], "player");
    this.AvailableEnergy = undefined;
  }

  attachEnergy(
    pokemon: InPlayPokemonCard,
    energy: Energy[],
    from: AttachEnergySource,
    fromPokemon?: InPlayPokemonCard
  ) {
    pokemon.attachEnergy(energy);
    this.logger.attachEnergy(this, pokemon, energy, from, fromPokemon);
  }

  transferEnergy(fromPokemon: InPlayPokemonCard, toPokemon: InPlayPokemonCard, energy: Energy[]) {
    for (const e of energy) {
      if (!fromPokemon.AttachedEnergy.includes(e)) {
        throw new Error("Energy not attached to fromPokemon");
      }
      removeElement(fromPokemon.AttachedEnergy, e);
    }
    toPokemon.attachEnergy(energy);

    this.logger.attachEnergy(this, toPokemon, energy, "pokemon", fromPokemon);
  }

  discardRandomEnergy(pokemon: InPlayPokemonCard, count: number = 1) {
    if (this.game.shouldPreventDamage(pokemon)) return;

    const energies = pokemon.AttachedEnergy;

    const discarded: Energy[] = [];
    for (let i = 0; i < count; i++) {
      if (energies.length == 0) break;
      const energy = randomElement(energies);
      discarded.push(removeElement(energies, energy));
    }

    this.discardEnergy(discarded, "effect", pokemon);
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

    const previousEnergy = currentActive.AttachedEnergy.slice();

    let modifiedCost = currentActive.RetreatCost;
    for (const status of this.PlayerStatuses) {
      if (status.type === "DecreaseRetreatCost") modifiedCost -= status.amount;
    }
    if (modifiedCost < 0) modifiedCost = 0;

    const effectiveEnergyToDiscard = currentActive.calculateEffectiveEnergy(energyToDiscard);
    if (modifiedCost > effectiveEnergyToDiscard.length) {
      throw new Error("Not enough energy provided");
    }

    const discardedEnergy: Energy[] = [];
    for (const e of energyToDiscard) {
      if (!previousEnergy.includes(e)) {
        throw new Error("Energy not attached to active Pokemon");
      }
      discardedEnergy.push(removeElement(previousEnergy, e));
    }
    currentActive.AttachedEnergy = previousEnergy;

    await this.swapActivePokemon(newActive, "retreat");
    this.discardEnergy(discardedEnergy, "retreat", currentActive);
  }

  async swapActivePokemon(
    newActive: InPlayPokemonCard,
    reason: "retreat" | "selfEffect" | "opponentEffect",
    choosingPlayer?: string
  ) {
    const currentActive = this.activeOrThrow();
    if (this.game.shouldPreventDamage(currentActive)) return;

    this.ActivePokemon = newActive;
    this.Bench[this.Bench.indexOf(newActive)] = currentActive;

    await currentActive.onLeaveActive(this.game);

    this.logger.swapActivePokemon(this, currentActive, newActive, reason, choosingPlayer);

    await newActive.onEnterActive(this.game);

    this.recoverAllSpecialConditions(currentActive);
  }

  recoverAllSpecialConditions(pokemon: InPlayPokemonCard) {
    const conditions = pokemon.CurrentConditions;
    if (conditions.length == 0) return;

    pokemon.PrimaryCondition = undefined;
    pokemon.SecondaryConditions = new Set();

    pokemon.PokemonStatuses = pokemon.PokemonStatuses.filter((status) => status.source != "Effect");

    this.logger.specialConditionEnded(this, conditions);
  }

  async removePokemonFromField(pokemon: InPlayPokemonCard) {
    if (this.game.shouldPreventDamage(pokemon)) return;

    await pokemon.onLeavePlay(this.game);
    if (pokemon == this.ActivePokemon) {
      await pokemon.onLeaveActive(this.game);
      this.ActivePokemon = EmptyCardSlot.Active();
    } else {
      await pokemon.onLeaveBench(this.game);
      const index = this.Bench.indexOf(pokemon);
      this.Bench[index] = EmptyCardSlot.Bench(index);
    }
  }

  async returnPokemonToHand(pokemon: InPlayPokemonCard) {
    if (this.game.shouldPreventDamage(pokemon)) return;

    await this.removePokemonFromField(pokemon);

    for (const card of pokemon.InPlayCards) {
      removeElement(this.InPlay, card);
      this.Hand.push(card);
    }

    this.logger.returnInPlayPokemonToHand(this, pokemon);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  async shufflePokemonIntoDeck(pokemon: InPlayPokemonCard) {
    if (this.game.shouldPreventDamage(pokemon)) return;

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

  async knockOutPokemon(pokemon: InPlayPokemonCard, fromAttack: boolean) {
    this.logger.pokemonKnockedOut(this, pokemon, fromAttack);

    for (const card of pokemon.InPlayCards) {
      if (!this.InPlay.includes(card)) console.log("Card not in play:", card);
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

  poisonActivePokemon() {
    const pokemon = this.activeOrThrow();
    if (this.game.shouldPreventDamage(pokemon)) return;

    pokemon.SecondaryConditions.add("Poisoned");
    this.logger.specialConditionApplied(this, "Poisoned");
  }

  sleepActivePokemon() {
    const pokemon = this.activeOrThrow();
    if (this.game.shouldPreventDamage(pokemon)) return;

    pokemon.PrimaryCondition = "Asleep";
    this.logger.specialConditionApplied(this, "Asleep");
  }

  paralyzeActivePokemon() {
    const pokemon = this.activeOrThrow();
    if (this.game.shouldPreventDamage(pokemon)) return;

    pokemon.PrimaryCondition = "Paralyzed";
    this.logger.specialConditionApplied(this, "Paralyzed");
  }

  applyActivePokemonStatus(status: PokemonStatus) {
    this.applyPokemonStatus(this.activeOrThrow(), status);
  }

  applyPokemonStatus(pokemon: InPlayPokemonCard, status: PokemonStatus) {
    if (this.game.shouldPreventDamage(pokemon)) return;

    pokemon.PokemonStatuses.push(status);
    this.logger.applyPokemonStatus(this, pokemon, status);
  }

  applyStatus(status: PlayerStatus) {
    this.PlayerStatuses.push(status);
    this.logger.applyPlayerStatus(this, status);
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
