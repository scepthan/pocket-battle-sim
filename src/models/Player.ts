import type { Deck } from "@/types/Deck";
import type { PlayingCard } from "@/types/PlayingCard";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";

export class Player {
  EnergyTypes: Energy[];
  Deck: PlayingCard[];
  Hand: PlayingCard[];
  InPlay: PlayingCard[];
  Discard: PlayingCard[];
  GamePoints: number;

  ActivePokemon?: InPlayPokemonCard;
  BenchedPokemon: InPlayPokemonCard[];
  AvailableEnergy?: Energy;
  NextEnergy: Energy;

  constructor(deck: Deck) {
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = deck.Cards;
    this.Hand = [];
    this.InPlay = [];
    this.Discard = [];
    this.BenchedPokemon = [];
    this.GamePoints = 0;
    this.NextEnergy = "Colorless";
  }

  setup(handSize: number) {
    this.drawInitialHand(handSize);
    this.chooseNextEnergy();
  }

  reset() {
    this.ActivePokemon = undefined;
    this.BenchedPokemon = [];

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

  drawCards(count: number) {
    while (count-- > 0 && this.Deck.length > 0) {
      this.Hand.push(this.Deck.shift()!);
    }
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
