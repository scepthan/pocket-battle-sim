import type { InPlayPokemonCard } from "@/models/InPlayPokemonCard";
import type { Energy } from "./Energy";
import type { PlayingCard, PokemonCard } from "./PlayingCard";
import type { PlayerGameView } from "@/models/PlayerGameView";

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
}
