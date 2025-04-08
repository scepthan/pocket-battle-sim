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
  GamePoints: number = 0; // The number of prize cards the player has taken (for winning the game)

  ActivePokemon?: InPlayPokemonCard; // The active Pokémon card (undefined only for setup phase)
  Bench: (InPlayPokemonCard | undefined)[] = []; // Pokémon cards on the bench, undefined if no Pokémon is in a slot
  AvailableEnergy?: Energy; // The energy type available for use this turn, if any (not used in all game modes)
  NextEnergy: Energy = "Colorless"; // The next energy type to be used for attaching to Pokémon, set when the game starts

  logger: GameLogger;

  get InPlayPokemon() {
    return [this.ActivePokemon, ...this.Bench].filter((x) => x !== undefined);
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
    this.shuffleDeck();
  }

  drawInitialHand(handSize: number) {
    this.reset();

    while (true) {
      this.drawCards(handSize, handSize, false);
      if (this.hasBasicPokemon()) {
        break;
      }
      this.shuffleHandIntoDeck();
    }

    this.logger.addEntry({
      type: "drawToHand",
      player: this.Name,
      attempted: handSize,
      cardIds: this.Hand.map((card) => card.ID),
      success: true,
    });
  }

  shuffleDeck() {
    const newDeck: PlayingCard[] = [];

    for (const card of this.Deck) {
      const insertIndex = Math.floor(Math.random() * (newDeck.length + 1));
      newDeck.splice(insertIndex, 0, card);
    }

    this.Deck = newDeck;
  }

  shuffleHandIntoDeck() {
    this.Deck = this.Deck.concat(this.Hand);
    this.Hand = [];
    this.shuffleDeck();
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

  drawRandomBasic() {
    const basicPokemon = this.Deck.filter(
      (card) => card.CardType == "Pokemon" && card.Stage == 0
    );
    const result = [];
    if (basicPokemon.length > 0) {
      const card = basicPokemon[(Math.random() * basicPokemon.length) | 0];
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
      failureReason: result.length == 0 ? "noBasicPokemon" : undefined,
    });

    this.shuffleDeck();
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

  putPokemonOnBench(card: PokemonCard, index: number) {
    if (this.Bench[index]) {
      throw new Error("Bench already has a Pokemon in this slot");
    }
    if (!this.Hand.includes(card)) {
      throw new Error("Card not in hand");
    }
    if (card.Stage != 0) {
      throw new Error("Can only play Basic Pokemon to bench");
    }

    this.Bench[index] = new InPlayPokemonCard(card);
    this.InPlay.push(card);
    this.Hand.splice(this.Hand.indexOf(card), 1);

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

    this.Hand.splice(this.Hand.indexOf(card), 1);
    this.InPlay.push(card);

    const newPokemon = new InPlayPokemonCard(card);
    newPokemon.InPlayCards.push(...pokemon.InPlayCards);
    newPokemon.CurrentHP = card.BaseHP - (pokemon.BaseHP - pokemon.CurrentHP);
    newPokemon.AttachedEnergy = pokemon.AttachedEnergy.slice();

    if (this.ActivePokemon == pokemon) {
      this.ActivePokemon = newPokemon;
    } else {
      this.Bench[this.Bench.indexOf(pokemon)] = newPokemon;
    }

    const statuses: string[] = pokemon.SecondaryStatuses.slice();
    if (pokemon.PrimaryStatus) statuses.unshift(pokemon.PrimaryStatus);
    for (const status of statuses) {
      this.logger.addEntry({
        type: "pokemonStatusEnded",
        player: this.Name,
        statusCondition: status,
        targetPokemon: this.pokemonToDescriptor(pokemon),
        currentStatusList: pokemon.SecondaryStatuses,
      });
    }

    this.logger.addEntry({
      type: "evolvePokemon",
      player: this.Name,
      cardId: card.ID,
      fromPokemon: this.pokemonToDescriptor(pokemon),
      stage: card.Stage,
    });
  }

  attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.AvailableEnergy) {
      throw new Error("No energy available to attach");
    }
    this.attachEnergy(pokemon, this.AvailableEnergy, "energyZone");
    this.AvailableEnergy = undefined;
  }

  attachEnergy(
    pokemon: InPlayPokemonCard,
    energy: Energy,
    from: "energyZone" | "discard" | "pokemon",
    fromPokemon?: InPlayPokemonCard
  ) {
    pokemon.attachEnergy(energy);
    this.logger.addEntry({
      type: "attachEnergy",
      player: this.Name,
      energyType: energy,
      from,
      targetPokemon: this.pokemonToDescriptor(pokemon),
      fromPokemon: fromPokemon && this.pokemonToDescriptor(fromPokemon),
    });
  }

  retreatActivePokemon(
    benchedPokemon: InPlayPokemonCard,
    energyToDiscard: Energy[],
    costModifier: number
  ) {
    const previousActive = this.ActivePokemon;
    if (!previousActive) {
      throw new Error("No active Pokemon to retreat");
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

    this.logger.addEntry({
      type: "discardEnergy",
      player: this.Name,
      source: "retreat",
      energyTypes: discardedEnergy,
    });
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
    if (pokemon.AttachedEnergy.length > 0) {
      this.logger.addEntry({
        type: "discardEnergy",
        player: this.Name,
        source: "knockOut",
        energyTypes: pokemon.AttachedEnergy,
      });
    }

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
    this.Hand = this.Hand.filter((card) => !cards.includes(card));
    this.Discard.push(...cards);
    this.logger.addEntry({
      type: "discardCards",
      player: this.Name,
      source: "hand",
      cardIds: cards.map((card) => card.ID),
    });
  }
}
