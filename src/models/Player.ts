import type { DeckInfo } from "@/types/DeckInfo";
import type { PlayingCard } from "@/types/PlayingCard";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Energy } from "@/types/Energy";

export class Player {
  EnergyTypes: Energy[];
  Deck: PlayingCard[];
  Hand: PlayingCard[];
  Discard: PlayingCard[];
  GamePoints: number;

  ActivePokemon?: InPlayPokemonCard;
  BenchedPokemon: InPlayPokemonCard[];
  AvailableEnergy?: Energy;
  NextEnergy: Energy;

  constructor(deck: DeckInfo) {
    if (
      !deck.Cards.some((card) => card.CardType == "Pokemon" && card.Stage == 0)
    )
      throw new Error("Cannot use a deck with no Basic Pokemon");

    if (
      !deck.Cards.some(
        (card) =>
          card.CardType == "Pokemon" &&
          card.Moves.some((move) =>
            move.RequiredEnergy.every(
              (energy) =>
                energy == "Colorless" || deck.EnergyTypes.includes(energy)
            )
          )
      )
    )
      throw new Error("Must be able to use at least one attack");

    for (const name of new Set(deck.Cards.map((card) => card.Name)))
      if (deck.Cards.filter((card) => card.Name == name).length > 2)
        throw new Error("Cannot use more than two cards with the same name");

    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = deck.Cards;
    this.Hand = [];
    this.Discard = [];
    this.BenchedPokemon = [];
    this.GamePoints = 0;
    this.NextEnergy = "Colorless";
  }

  setup() {
    this.drawInitialHand(5);
    this.chooseNextEnergy();
  }

  reset() {
    this.Deck = this.Deck.concat(this.Hand, this.Discard, this.BenchedPokemon);
    if (this.ActivePokemon) this.Deck.push(this.ActivePokemon);

    this.ActivePokemon = undefined;
    this.BenchedPokemon = [];
    this.Discard = [];
    this.Hand = [];
    this.shuffleDeck();
  }

  drawInitialHand(handSize: number) {
    this.reset();

    while (true) {
      this.drawCards(handSize);
      if (
        this.Hand.some((card) => card.CardType == "Pokemon" && card.Stage == 0)
      )
        break;
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
}
