import type { Energy, PlayingCard, PokemonCard } from "../types";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { PlayerGameView } from "./PlayerGameView";

export type BenchSetup = (PokemonCard | undefined)[];
export interface PlayerGameSetup {
  active: PokemonCard;
  bench: BenchSetup;
}
export interface GameInitState {
  hand: PlayingCard[];
  isGoingFirst: boolean;
  firstEnergy: Energy;
}

export interface PlayerAgent {
  Name: string;
  EnergyTypes: Energy[];
  Deck: PlayingCard[];

  setupPokemon: (gameState: GameInitState) => Promise<PlayerGameSetup>;
  doTurn: (gameState: PlayerGameView) => Promise<void>;
  swapActivePokemon: (gameState: PlayerGameView) => Promise<InPlayPokemonCard>;
  choosePokemon: (pokemon: InPlayPokemonCard[]) => Promise<InPlayPokemonCard>;
  choose: <T>(options: T[]) => Promise<T>;
  viewCards: (cards: PlayingCard[]) => Promise<void>;
}
