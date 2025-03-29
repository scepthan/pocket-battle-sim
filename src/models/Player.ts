import type { Deck } from "@/types/Deck";
import type { PlayingCard } from "@/types/PlayingCard";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";

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

  setup(handSize: number) {
    this.drawInitialHand(handSize);
    this.chooseNextEnergy();
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
      this.drawCards(handSize);
      if (this.hasBasicPokemon()) {
        break;
      }
      this.shuffleHandIntoDeck();
    }
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

  drawCards(count: number, maxHandSize: number) {
    let cardsDrawn = 0;
    while (cardsDrawn < count) {
      if (this.Deck.length == 0) {
        return { success: false, cardsDrawn, message: "Deck is empty" };
      }
      if (this.Hand.length >= maxHandSize) {
        return { success: false, cardsDrawn, message: "Hand is full" };
      }
      this.Hand.push(this.Deck.shift()!);
      cardsDrawn += 1;
    }
    return { success: true, cardsDrawn, message: "Cards drawn successfully" };
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
}
