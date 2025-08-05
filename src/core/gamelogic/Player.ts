import type {
  AttachEnergySource,
  DiscardEnergySource,
  GameLogger,
  InPlayPokemonDescriptor,
} from "../logging";
import type { Deck, Energy, PlayingCard, PokemonCard } from "../types";
import { CoinFlipper } from "./CoinFlipper";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { PlayerGameSetup } from "./types/PlayerAgent";

export class Player {
  Name: string;
  EnergyTypes: Energy[]; // The types of energy available in the player's deck
  Deck: PlayingCard[]; // The player's deck of cards, initially set from the provided deck
  Hand: PlayingCard[] = []; // Cards in the player's hand
  InPlay: PlayingCard[] = []; // Cards that are currently in play (active or benched Pokémon)
  Discard: PlayingCard[] = []; // Cards that have been discarded during the game
  DiscardedEnergy: Energy[] = []; // Energy that has been discarded during the game
  GamePoints: number = 0; // The number of prize cards the player has taken (for winning the game)

  ActivePokemon?: InPlayPokemonCard; // The active Pokémon card (undefined only for setup phase)
  Bench: (InPlayPokemonCard | undefined)[] = []; // Pokémon cards on the bench, undefined if no Pokémon is in a slot
  AvailableEnergy?: Energy; // The energy type available for use this turn, if any (not used in all game modes)
  NextEnergy: Energy = "Colorless"; // The next energy type to be used for attaching to Pokémon, set when the game starts

  logger: GameLogger;
  private flipper: CoinFlipper;

  get InPlayPokemon() {
    return [this.ActivePokemon, ...this.Bench].filter((x) => x !== undefined);
  }
  get BenchedPokemon() {
    return this.Bench.filter((x) => x !== undefined);
  }

  constructor(name: string, deck: Deck, logger: GameLogger) {
    this.Name = name;
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = deck.Cards;
    this.logger = logger;
    this.flipper = new CoinFlipper(this);
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
    this.ActivePokemon = undefined;
    this.Bench = [];

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
    const length = this.EnergyTypes.length;
    if (length == 1) {
      this.NextEnergy = this.EnergyTypes[0];
    } else {
      const randomIndex = Math.floor(Math.random() * length);
      this.NextEnergy = this.EnergyTypes[randomIndex];
    }
  }

  hasBasicPokemon() {
    return this.Hand.some((card) => card.CardType == "Pokemon" && card.Stage == 0);
  }

  setupPokemon(setup: PlayerGameSetup) {
    // Set up the active Pokémon
    if (!this.Hand.includes(setup.active)) {
      throw new Error("Card not in hand");
    }
    if (setup.active.Stage != 0) {
      throw new Error("Can only play Basic Pokemon at game start");
    }

    this.ActivePokemon = new InPlayPokemonCard(setup.active);
    this.InPlay.push(setup.active);
    this.Hand.splice(this.Hand.indexOf(setup.active), 1);

    this.logger.playToActive(this, setup.active);

    // Set up the bench Pokémon
    setup.bench.forEach((card, i) => {
      if (!card) return;
      this.putPokemonOnBench(card, i);
    });
  }

  drawRandomFiltered(predicate: (card: PlayingCard) => boolean) {
    const filteredCards = this.Deck.filter(predicate);
    let card = undefined;
    if (filteredCards.length > 0) {
      card = filteredCards[(Math.random() * filteredCards.length) | 0];
      this.Deck.splice(this.Deck.indexOf(card), 1);
      this.Hand.push(card);
    }

    this.logger.drawRandomFiltered(this, card);

    this.shuffleDeck();
  }

  discardRandomFiltered(predicate: (card: PlayingCard) => boolean = () => true) {
    const filteredCards = this.Hand.filter(predicate);
    const discarded: PlayingCard[] = [];
    if (filteredCards.length > 0) {
      const index = Math.floor(Math.random() * filteredCards.length);
      const card = filteredCards[index];
      discarded.push(card);
      this.Hand.splice(this.Hand.indexOf(card), 1);
      this.Discard.push(card);
    }

    this.logger.discardFromHand(this, discarded);

    return discarded;
  }

  setNewActivePokemon(pokemon: InPlayPokemonCard) {
    if (!this.Bench.includes(pokemon)) {
      throw new Error("Pokemon not on bench");
    }
    this.ActivePokemon = pokemon;
    this.Bench[this.Bench.indexOf(pokemon)] = undefined;

    this.logger.selectActivePokemon(this);
  }

  putPokemonOnBench(card: PokemonCard, index: number, trueCard: PlayingCard = card) {
    if (this.Bench[index]) {
      throw new Error("Bench already has a Pokemon in this slot");
    }
    if (card.Stage != 0) {
      throw new Error("Can only play Basic Pokemon to bench");
    }

    this.Bench[index] = new InPlayPokemonCard(card);
    this.InPlay.push(trueCard);
    // Needs to be optional because fossils are currently removed from hand before this method is called
    if (this.Hand.includes(trueCard)) {
      this.Hand.splice(this.Hand.indexOf(trueCard), 1);
    }

    this.logger.playToBench(this, card, index);
  }

  evolvePokemon(pokemon: InPlayPokemonCard, card: PokemonCard) {
    if (!this.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.EvolvesFrom != pokemon.Name) {
      throw new Error("Card does not evolve from this Pokemon");
    }
    if (!pokemon.ReadyToEvolve) {
      throw new Error("Pokemon is not ready to evolve");
    }

    this.Hand.splice(this.Hand.indexOf(card), 1);
    this.InPlay.push(card);

    this.logger.evolvePokemon(this, pokemon, card);
    pokemon.evolveInto(card);

    this.recoverAllSpecialConditions(pokemon);
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
      fromPokemon.AttachedEnergy.splice(fromPokemon.AttachedEnergy.indexOf(e), 1);
    }
    toPokemon.attachEnergy(energy);

    this.logger.attachEnergy(this, toPokemon, energy, "pokemon", fromPokemon);
  }

  discardRandomEnergy(pokemon: InPlayPokemonCard, count: number = 1) {
    const energies = pokemon.AttachedEnergy;

    const discarded: Energy[] = [];
    for (let i = 0; i < count; i++) {
      if (energies.length == 0) break;
      const index = Math.floor(Math.random() * energies.length);
      discarded.push(energies.splice(index, 1)[0]);
    }

    this.discardEnergy(discarded, "effect");
  }

  discardEnergy(energies: Energy[], source: DiscardEnergySource) {
    if (energies.length == 0) return;

    this.DiscardedEnergy.push(...energies);

    this.logger.discardEnergy(this, energies, source);
  }

  retreatActivePokemon(
    benchedPokemon: InPlayPokemonCard,
    energyToDiscard: Energy[],
    costModifier: number
  ) {
    const previousActive = this.ActivePokemon!;
    if (previousActive.RetreatCost == -1) {
      throw new Error("This Pokémon cannot retreat");
    }
    if (
      previousActive.PrimaryCondition == "Asleep" ||
      previousActive.PrimaryCondition == "Paralyzed"
    ) {
      throw new Error("Cannot retreat while " + previousActive.PrimaryCondition);
    }

    const previousEnergy = previousActive.AttachedEnergy.slice();
    const modifiedCost = (previousActive.RetreatCost ?? 0) + costModifier;

    if (modifiedCost > previousEnergy.length) {
      throw new Error("Not enough energy to retreat");
    }
    if (modifiedCost > energyToDiscard.length) {
      throw new Error("Not enough energy provided");
    }

    const discardedEnergy: Energy[] = [];
    for (const e of energyToDiscard) {
      if (!previousEnergy.includes(e)) {
        throw new Error("Energy not attached to active Pokemon");
      }
      discardedEnergy.push(previousEnergy.splice(previousEnergy.indexOf(e), 1)[0]);
    }
    previousActive.AttachedEnergy = previousEnergy;

    this.swapActivePokemon(benchedPokemon, "retreat");
    this.discardEnergy(discardedEnergy, "retreat");
  }

  swapActivePokemon(
    pokemon: InPlayPokemonCard,
    reason: "retreat" | "selfEffect" | "opponentEffect",
    choosingPlayer?: string
  ) {
    const previousActive = this.ActivePokemon!;
    this.ActivePokemon = pokemon;
    this.Bench[this.Bench.indexOf(pokemon)] = previousActive;

    this.logger.swapActivePokemon(this, previousActive, pokemon, reason, choosingPlayer);

    this.recoverAllSpecialConditions(previousActive);
  }

  recoverAllSpecialConditions(pokemon: InPlayPokemonCard) {
    const conditions = pokemon.CurrentConditions;
    if (conditions.length == 0) return;

    pokemon.PrimaryCondition = undefined;
    pokemon.SecondaryConditions = new Set();

    this.logger.specialConditionEnded(this, conditions);
  }

  returnPokemonToHand(pokemon: InPlayPokemonCard) {
    if (pokemon == this.ActivePokemon) {
      this.ActivePokemon = undefined;
    } else {
      this.Bench[this.Bench.indexOf(pokemon)] = undefined;
    }

    for (const card of pokemon.InPlayCards) {
      this.InPlay.splice(this.InPlay.indexOf(card), 1);
      this.Hand.push(card);
    }

    this.logger.returnInPlayPokemonToHand(this, pokemon);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");
  }

  shufflePokemonIntoDeck(pokemon: InPlayPokemonCard) {
    if (pokemon == this.ActivePokemon) {
      this.ActivePokemon = undefined;
    } else {
      this.Bench[this.Bench.indexOf(pokemon)] = undefined;
    }

    for (const card of pokemon.InPlayCards) {
      this.InPlay.splice(this.InPlay.indexOf(card), 1);
      this.Deck.push(card);
    }

    this.logger.returnInPlayPokemonToDeck(this, pokemon);

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");

    this.shuffleDeck();
  }

  knockOutPokemon(pokemon: InPlayPokemonCard) {
    this.logger.pokemonKnockedOut(this, pokemon);

    for (const card of pokemon.InPlayCards) {
      this.InPlay.splice(this.InPlay.indexOf(card), 1);
      this.Discard.push(card);
    }
    this.logger.discardFromPlay(this, pokemon.InPlayCards);

    this.discardEnergy(pokemon.AttachedEnergy, "knockOut");

    if (this.ActivePokemon == pokemon) {
      this.ActivePokemon = undefined;
    } else {
      this.Bench[this.Bench.indexOf(pokemon)] = undefined;
    }
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
    this.ActivePokemon!.SecondaryConditions.add("Poisoned");
    this.logger.specialConditionApplied(this, "Poisoned");
  }

  sleepActivePokemon() {
    this.ActivePokemon!.PrimaryCondition = "Asleep";
    this.logger.specialConditionApplied(this, "Asleep");
  }

  paralyzeActivePokemon() {
    this.ActivePokemon!.PrimaryCondition = "Paralyzed";
    this.logger.specialConditionApplied(this, "Paralyzed");
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
