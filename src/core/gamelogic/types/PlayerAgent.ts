import { parseDeck } from "../../parsing";
import type { InPlayPokemonCard } from "../InPlayPokemonCard";
import type { PlayerGameView } from "../PlayerGameView";
import type { DeckInfo } from "./Deck";
import type { Energy } from "./Energy";
import type { PlayingCard, PokemonCard } from "./PlayingCard";

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

  abstract setupPokemon(game: GameInitState): Promise<PlayerGameSetup>;
  abstract doTurn(game: PlayerGameView): Promise<void>;
  abstract swapActivePokemon(game: PlayerGameView): Promise<InPlayPokemonCard>;
  abstract choosePokemon(pokemon: InPlayPokemonCard[]): Promise<InPlayPokemonCard>;
  abstract choose<T>(options: T[]): Promise<T>;
  abstract viewCards(cards: PlayingCard[]): Promise<void>;
  abstract distributeEnergy(pokemon: InPlayPokemonCard[], energy: Energy[]): Promise<Energy[][]>;
}
