import type {
  Deck,
  Energy,
  PlayerGameSetup,
  PlayingCard,
  PokemonCard,
} from "@/types";
import type {
  GameLogger,
  InPlayPokemonDescriptor,
  LoggedEvent,
} from "./GameLogger";
import { InPlayPokemonCard } from "./InPlayPokemonCard";

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
    this.logger.addEntry({
      type: "generateNextEnergy",
      player: this.Name,
      currentEnergy: "none",
      nextEnergy: this.NextEnergy,
    });
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

    this.logger.addEntry({
      type: "drawToHand",
      player: this.Name,
      attempted: handSize,
      cardIds: this.Hand.map((card) => card.ID),
      success: true,
    });
  }

  shuffleDeck(log: boolean = true) {
    const newDeck: PlayingCard[] = [];

    for (const card of this.Deck) {
      const insertIndex = Math.floor(Math.random() * (newDeck.length + 1));
      newDeck.splice(insertIndex, 0, card);
    }

    this.Deck = newDeck;

    if (log) {
      this.logger.addEntry({
        type: "shuffleDeck",
        player: this.Name,
      });
    }
  }

  shuffleHandIntoDeck(log: boolean = true) {
    this.Deck = this.Deck.concat(this.Hand);
    this.Hand = [];
    this.shuffleDeck(log);
  }

  drawCards(count: number, maxHandSize: number, log: boolean = true) {
    const cardsDrawn: PlayingCard[] = [];
    const logEntry: LoggedEvent = {
      type: "drawToHand",
      player: this.Name,
      attempted: count,
      cardIds: [],
      success: true,
    };
    while (cardsDrawn.length < count) {
      if (this.Deck.length == 0) {
        logEntry.success = false;
        logEntry.failureReason = "deckEmpty";
        break;
      }
      if (this.Hand.length >= maxHandSize) {
        logEntry.success = false;
        logEntry.failureReason = "handFull";
        break;
      }
      cardsDrawn.push(this.Deck.shift()!);
    }
    this.Hand.push(...cardsDrawn);
    logEntry.cardIds = cardsDrawn.map((card) => card.ID);
    if (log) this.logger?.addEntry(logEntry);
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
    return this.Hand.some(
      (card) => card.CardType == "Pokemon" && card.Stage == 0
    );
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

    this.logger.addEntry({
      type: "playToActive",
      player: this.Name,
      cardId: setup.active.ID,
    });

    // Set up the bench Pokémon
    setup.bench.forEach((card, i) => {
      if (!card) return;
      this.putPokemonOnBench(card, i);
    });
  }

  drawRandomFiltered(predicate: (card: PlayingCard) => boolean) {
    const filteredPokemon = this.Deck.filter(predicate);
    const result = [];
    if (filteredPokemon.length > 0) {
      const card =
        filteredPokemon[(Math.random() * filteredPokemon.length) | 0];
      result.push(card);
      this.Deck.splice(this.Deck.indexOf(card), 1);
      this.Hand.push(card);
    }

    this.logger.addEntry({
      type: "drawToHand",
      player: this.Name,
      attempted: 1,
      cardIds: result.map((card) => card.ID),
      success: result.length > 0,
      failureReason: result.length == 0 ? "noValidCards" : undefined,
    });

    this.shuffleDeck();

    return;
  }

  discardRandomFiltered(
    predicate: (card: PlayingCard) => boolean = () => true
  ) {
    const filteredCards = this.Hand.filter(predicate);
    const discarded: PlayingCard[] = [];
    if (filteredCards.length > 0) {
      const index = Math.floor(Math.random() * filteredCards.length);
      const card = filteredCards[index];
      discarded.push(card);
      this.Hand.splice(this.Hand.indexOf(card), 1);
      this.Discard.push(card);
    }

    this.logger.addEntry({
      type: "discardCards",
      player: this.Name,
      source: "hand",
      cardIds: discarded.map((card) => card.ID),
    });

    return discarded;
  }

  setNewActivePokemon(pokemon: InPlayPokemonCard) {
    if (!this.Bench.includes(pokemon)) {
      throw new Error("Pokemon not on bench");
    }
    this.ActivePokemon = pokemon;
    this.Bench[this.Bench.indexOf(pokemon)] = undefined;

    this.logger.addEntry({
      type: "selectActivePokemon",
      player: this.Name,
      toPokemon: this.pokemonToDescriptor(pokemon),
    });
  }

  putPokemonOnBench(
    card: PokemonCard,
    index: number,
    trueCard: PlayingCard = card
  ) {
    if (this.Bench[index]) {
      throw new Error("Bench already has a Pokemon in this slot");
    }
    if (card.Stage != 0) {
      throw new Error("Can only play Basic Pokemon to bench");
    }

    this.Bench[index] = new InPlayPokemonCard(card);
    this.InPlay.push(trueCard);
    this.Hand.splice(this.Hand.indexOf(trueCard), 1);

    this.logger.addEntry({
      type: "playToBench",
      player: this.Name,
      cardId: card.ID,
      benchIndex: index,
    });
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

    // Save info for logging purposes
    const beforePokemon = this.pokemonToDescriptor(pokemon);

    this.Hand.splice(this.Hand.indexOf(card), 1);
    this.InPlay.push(card);

    pokemon.evolveInto(card);

    this.logger.addEntry({
      type: "evolvePokemon",
      player: this.Name,
      fromPokemon: beforePokemon,
      cardId: card.ID,
      stage: card.Stage,
    });
    this.recoverAllStatusConditions(pokemon);
  }

  attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.AvailableEnergy) {
      throw new Error("No energy available to attach");
    }
    this.attachEnergy(pokemon, [this.AvailableEnergy], "energyZone");
    this.AvailableEnergy = undefined;
  }

  attachEnergy(
    pokemon: InPlayPokemonCard,
    energy: Energy[],
    from: "energyZone" | "discard" | "pokemon",
    fromPokemon?: InPlayPokemonCard
  ) {
    pokemon.attachEnergy(energy);
    this.logger.addEntry({
      type: "attachEnergy",
      player: this.Name,
      energyTypes: energy,
      from,
      targetPokemon: this.pokemonToDescriptor(pokemon),
      fromPokemon: fromPokemon && this.pokemonToDescriptor(fromPokemon),
    });
  }

  transferEnergy(
    fromPokemon: InPlayPokemonCard,
    toPokemon: InPlayPokemonCard,
    energy: Energy[]
  ) {
    for (const e of energy) {
      if (!fromPokemon.AttachedEnergy.includes(e)) {
        throw new Error("Energy not attached to fromPokemon");
      }
      fromPokemon.AttachedEnergy.splice(
        fromPokemon.AttachedEnergy.indexOf(e),
        1
      );
    }
    toPokemon.attachEnergy(energy);

    this.logger.addEntry({
      type: "attachEnergy",
      player: this.Name,
      targetPokemon: this.pokemonToDescriptor(toPokemon),
      energyTypes: energy,
      from: "pokemon",
      fromPokemon: this.pokemonToDescriptor(fromPokemon),
    });
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

  discardEnergy(
    energies: Energy[],
    source:
      | "effect"
      | "retreat"
      | "knockOut"
      | "removedFromField"
      | "energyZone"
  ) {
    if (energies.length == 0) return;

    this.DiscardedEnergy.push(...energies);

    this.logger.addEntry({
      type: "discardEnergy",
      player: this.Name,
      source: source,
      energyTypes: energies,
    });
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
      previousActive.PrimaryStatus == "Asleep" ||
      previousActive.PrimaryStatus == "Paralyzed"
    ) {
      throw new Error("Cannot retreat while " + previousActive.PrimaryStatus);
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
      discardedEnergy.push(
        previousEnergy.splice(previousEnergy.indexOf(e), 1)[0]
      );
    }
    previousActive.AttachedEnergy = previousEnergy;

    this.swapActivePokemon(benchedPokemon, "retreat");
    this.discardEnergy(discardedEnergy, "retreat");
  }

  swapActivePokemon(
    pokemon: InPlayPokemonCard,
    reason: "retreat" | "selfEffect" | "opponentEffect"
  ) {
    const previousActive = this.ActivePokemon!;
    this.ActivePokemon = pokemon;
    this.Bench[this.Bench.indexOf(pokemon)] = previousActive;

    this.logger.addEntry({
      type: "swapActivePokemon",
      player: this.Name,
      fromPokemon: this.pokemonToDescriptor(previousActive),
      toPokemon: this.pokemonToDescriptor(pokemon),
      reason,
    });

    this.recoverAllStatusConditions(previousActive);
  }

  recoverAllStatusConditions(pokemon: InPlayPokemonCard) {
    const statuses = pokemon.CurrentStatuses;
    if (statuses.length == 0) return;

    pokemon.PrimaryStatus = undefined;
    pokemon.SecondaryStatuses = new Set();

    this.logger.addEntry({
      type: "pokemonStatusEnded",
      player: this.Name,
      statusConditions: statuses,
      targetPokemon: this.pokemonToDescriptor(pokemon),
      currentStatusList: pokemon.CurrentStatuses,
    });
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

    this.logger.addEntry({
      type: "returnToHand",
      player: this.Name,
      cardIds: pokemon.InPlayCards.map((card) => card.ID),
    });

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

    this.logger.addEntry({
      type: "returnToDeck",
      player: this.Name,
      cardIds: pokemon.InPlayCards.map((card) => card.ID),
    });

    this.discardEnergy(pokemon.AttachedEnergy, "removedFromField");

    this.shuffleDeck();
  }

  knockOutPokemon(pokemon: InPlayPokemonCard) {
    this.logger.addEntry({
      type: "pokemonKnockedOut",
      player: this.Name,
      targetPokemon: this.pokemonToDescriptor(pokemon),
    });
    for (const card of pokemon.InPlayCards) {
      this.InPlay.splice(this.InPlay.indexOf(card), 1);
      this.Discard.push(card);
    }
    this.logger.addEntry({
      type: "discardCards",
      player: this.Name,
      source: "inPlay",
      cardIds: pokemon.InPlayCards.map((card) => card.ID),
    });
    this.discardEnergy(pokemon.AttachedEnergy, "knockOut");

    if (this.ActivePokemon == pokemon) {
      this.ActivePokemon = undefined;
    } else {
      this.Bench[this.Bench.indexOf(pokemon)] = undefined;
    }
  }

  checkPrizePointsChange(previousPoints: number) {
    if (this.GamePoints > previousPoints) {
      this.logger.addEntry({
        type: "scorePrizePoints",
        player: this.Name,
        prizePointsScored: this.GamePoints - previousPoints,
        totalPrizePoints: this.GamePoints,
      });
    }
  }

  discardCardsFromHand(cards: PlayingCard[]) {
    cards = cards.filter((card) => this.Hand.includes(card));
    if (cards.length == 0) return;
    this.Hand = this.Hand.filter((card) => !cards.includes(card));
    this.Discard.push(...cards);
    this.logger.addEntry({
      type: "discardCards",
      player: this.Name,
      source: "hand",
      cardIds: cards.map((card) => card.ID),
    });
  }

  poisonActivePokemon() {
    this.ActivePokemon!.SecondaryStatuses.add("Poisoned");

    this.logger.addEntry({
      type: "pokemonStatusApplied",
      player: this.Name,
      statusConditions: ["Poisoned"],
      targetPokemon: this.pokemonToDescriptor(this.ActivePokemon!),
      currentStatusList: this.ActivePokemon!.CurrentStatuses,
    });
  }

  sleepActivePokemon() {
    this.ActivePokemon!.PrimaryStatus = "Asleep";

    this.logger.addEntry({
      type: "pokemonStatusApplied",
      player: this.Name,
      statusConditions: ["Asleep"],
      targetPokemon: this.pokemonToDescriptor(this.ActivePokemon!),
      currentStatusList: this.ActivePokemon!.CurrentStatuses,
    });
  }

  paralyzeActivePokemon() {
    this.ActivePokemon!.PrimaryStatus = "Paralyzed";

    this.logger.addEntry({
      type: "pokemonStatusApplied",
      player: this.Name,
      statusConditions: ["Paralyzed"],
      targetPokemon: this.pokemonToDescriptor(this.ActivePokemon!),
      currentStatusList: this.ActivePokemon!.CurrentStatuses,
    });
  }
}
