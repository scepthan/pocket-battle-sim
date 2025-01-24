import type { InPlayPokemonCard } from "@/models/InPlayPokemonCard";
import type { Energy } from "./Energy";
import type { Move, PlayingCard, PokemonCard } from "./PlayingCard";
import type { PlayerGameView } from "@/models/PlayerGameView";

export type BenchSetup = [
  PokemonCard | undefined,
  PokemonCard | undefined,
  PokemonCard | undefined
];
export interface GameInitState {
  hand: PlayingCard[];
  isGoingFirst: boolean;
  firstEnergy: Energy;
}

export interface PlayerAgent {
  EnergyTypes: Energy[];
  Deck: PlayingCard[];

  setupPokemon: (gameState: GameInitState) => Promise<{
    active: PokemonCard;
    bench: BenchSetup;
  }>;
  doTurn: (gameState: PlayerGameView) => Promise<Move | undefined>;
  swapActivePokemon: (gameState: PlayerGameView) => Promise<InPlayPokemonCard>;
}
