import { parseDeck } from "../parsing";
import type { DeckInfo, Energy, PlayingCard, PokemonCard } from "../types";
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

export abstract class PlayerAgent {
  Name: string;
  EnergyTypes: Energy[];
  Deck: PlayingCard[];

  constructor(name: string, deck: DeckInfo) {
    this.Name = name;
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = parseDeck(deck.Cards);
  }

  abstract setupPokemon(gameState: GameInitState): Promise<PlayerGameSetup>;
  abstract doTurn(gameState: PlayerGameView): Promise<void>;
  abstract swapActivePokemon(gameState: PlayerGameView): Promise<InPlayPokemonCard>;
  abstract choosePokemon(pokemon: InPlayPokemonCard[]): Promise<InPlayPokemonCard>;
  abstract choose<T>(options: T[]): Promise<T>;
  abstract viewCards(cards: PlayingCard[]): Promise<void>;
}
