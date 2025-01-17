import type { Deck } from "@/types/Deck.js";
import type { Energy, PlayingCard, PokemonCard } from "@/types/PlayingCard.js";

export class Player {
  EnergyTypes: Energy[];
  Deck: PlayingCard[];
  Hand: PlayingCard[];
  Discard: PlayingCard[];

  ActivePokemon?: PokemonCard;
  BenchedPokemon: PokemonCard[];

  constructor(deck: Deck) {
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
      this.shuffleHandIntoDeck;
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
}
