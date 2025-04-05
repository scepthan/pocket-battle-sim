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

  constructor(name: string, deck: DeckInfo) {
    const { parseDeck } = usePlayingCardStore();

    this.Name = name;
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
    await wait(1000);
    if (gameState.selfAvailableEnergy) {
      const ownPokemon = [
        gameState.selfActive,
        ...gameState.selfBenched,
      ].filter((x) => x !== undefined);
      gameState.attachAvailableEnergy(
        ownPokemon[(Math.random() * ownPokemon.length) | 0]
      );
      await wait(1000);
    }

    const handBasics = gameState.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    if (handBasics.length > 0) {
      const randomBasic = handBasics[(Math.random() * handBasics.length) | 0];
      const bench = gameState.selfBenched;
      for (let i = 0; i < 3; i++) {
        if (bench[i] == undefined) {
          gameState.playPokemonToBench(randomBasic, i);
          break;
        }
      }
      await wait(1000);
    }
    return;
  }

  async swapActivePokemon(gameState: PlayerGameView) {
    const bench = gameState.selfBenched;
    return bench[(Math.random() * bench.length) | 0];
  }
}
