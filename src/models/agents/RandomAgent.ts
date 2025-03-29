import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import type { DeckInfo } from "@/types/Deck";
import type { Energy } from "@/types/Energy";
import type { GameInitState, PlayerAgent } from "@/types/PlayerAgent";
import type { PlayingCard, PokemonCard } from "@/types/PlayingCard";
import type { PlayerGameView } from "../PlayerGameView";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RandomAgent implements PlayerAgent {
  Name: string = "Random Agent";
  EnergyTypes: Energy[];
  Deck: PlayingCard[];

  constructor(deck: DeckInfo) {
    const { parseDeck } = usePlayingCardStore();

    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = parseDeck(deck.Cards);
  }

  async setupPokemon(gameState: GameInitState) {
    const basicPokemon = gameState.hand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    if (basicPokemon.length === 0) {
      throw new Error("No basic Pokemon in hand");
    }

    return {
      active: basicPokemon[0],
      bench: basicPokemon.slice(1, 4),
    };
  }

  async doTurn(gameState: PlayerGameView) {
    console.log(gameState);
    wait(1000); // wait for 1 second to simulate thinking time
    return undefined;
  }

  async swapActivePokemon(gameState: PlayerGameView) {
    const bench = gameState.selfBenched;
    return bench[(Math.random() * bench.length) | 0];
  }
}
