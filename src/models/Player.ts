import type { Deck } from "@/types/Deck";
import type { PlayingCard, PokemonCard } from "@/types/PlayingCard";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";
import type { GameLogger, LoggedEvent } from "./GameLogger";
import type { PlayerGameSetup } from "@/types/PlayerAgent";

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

  constructor(name: string, deck: Deck) {
    this.Name = name;
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = deck.Cards;
  }

  setup(handSize: number, logger: GameLogger) {
    this.drawInitialHand(handSize, logger);

    this.chooseNextEnergy();
    logger.addEntry({
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

  drawInitialHand(handSize: number, logger: GameLogger) {
    this.reset();

    while (true) {
      this.drawCards(handSize, handSize);
      if (this.hasBasicPokemon()) {
        break;
      }
      this.shuffleHandIntoDeck();
    }

    logger.addEntry({
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

  drawCards(count: number, maxHandSize: number, logger?: GameLogger) {
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
    logger?.addEntry(logEntry);
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

  setupPokemon(setup: PlayerGameSetup, logger: GameLogger) {
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

    logger.addEntry({
      type: "playToActive",
      player: this.Name,
      cardId: setup.active.ID,
    });

    // Set up the bench Pokémon
    setup.bench.forEach((card, i) => {
      if (!card) return;
      this.putPokemonOnBench(card, i, logger);
    });
  }

  putPokemonOnBench(card: PokemonCard, index: number, logger: GameLogger) {
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

    logger.addEntry({
      type: "playToBench",
      player: this.Name,
      cardId: card.ID,
      benchIndex: index,
    });
  }
}
