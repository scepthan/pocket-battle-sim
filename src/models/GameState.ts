import type { PlayingCard, PokemonCard } from "@/types/PlayingCard.js";
import { Player } from "./Player.js";
import type { Deck } from "@/types/Deck.js";

export class GameState {
  Player1: Player;
  Player2: Player;

  constructor(deck1: Deck, deck2: Deck) {
    this.Player1 = new Player(deck1);
    this.Player2 = new Player(deck2);
  }
}
