import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import type { DeckInfo } from "@/types/Deck";
import type { Energy } from "@/types/Energy";
import type { GameInitState, PlayerAgent } from "@/types/PlayerAgent";
import type { PlayingCard, PokemonCard } from "@/types/PlayingCard";
import type { PlayerGameView } from "../PlayerGameView";

export class RandomAgent implements PlayerAgent {
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
    return {
      active: basicPokemon[(Math.random() * basicPokemon.length) | 0],
      bench: [],
    };
  }

  async doTurn(gameState: PlayerGameView) {
    console.log(gameState);
    return undefined;
  }

  async swapActivePokemon(gameState: PlayerGameView) {
    const bench = gameState.selfBenched;
    return bench[(Math.random() * bench.length) | 0];
  }
}
