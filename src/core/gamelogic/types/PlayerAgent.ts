/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomElement, removeElement } from "@/core/util";
import { parseDeck } from "../../parsing";
import type { PlayerGameView } from "../PlayerGameView";
import type { PlayerPokemonView } from "../PlayerPokemonView";
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

  /**
   * Choose initial Pokémon setup at the start of the game.
   */
  abstract setupPokemon(game: GameInitState): Promise<PlayerGameSetup>;

  /**
   * The main function called each turn to perform actions, which are provided by PlayerGameView.
   */
  abstract doTurn(game: PlayerGameView): Promise<void>;

  /**
   * Choose a Benched Pokémon to swap in as the new Active Pokémon.
   *
   * By default, calls `this.choosePokemon()` with the current Benched Pokémon.
   */
  async swapActivePokemon(
    game: PlayerGameView,
    reason: "selfEffect" | "opponentEffect" | "activeKnockedOut"
  ): Promise<PlayerPokemonView> {
    return this.choosePokemon(game.selfBenched);
  }

  /**
   * Given a list of options, choose an element from it. The list is guaranteed to be non-empty.
   *
   * By default, returns a random element.
   */
  async choose<T>(options: T[]): Promise<T> {
    return randomElement(options);
  }
  /**
   * Given a list of some Pokémon currently in play, choose one of them. The list is guaranteed to
   * be non-empty.
   *
   * By default, calls `this.choose()` (random unless this function is user-defined).
   */
  async choosePokemon(pokemon: PlayerPokemonView[]): Promise<PlayerPokemonView> {
    return this.choose(pokemon);
  }
  /**
   * Given a list of options, choose n unique elements from it. The list is guaranteed to be of
   * length > n.
   *
   * By default, returns n random elements.
   */
  async chooseN<T>(options: T[], n: number): Promise<T[]> {
    const input = options.slice();
    const output: T[] = [];
    for (let i = 0; i < n; i++) {
      const choice = randomElement(input);
      output.push(choice);
      removeElement(input, choice);
    }
    return output;
  }
  /**
   * Given a list of some Pokémon currently in play, choose n unique Pokémon from it. The list is
   * guaranteed to be of length > n.
   *
   * By default, calls `this.chooseN()` (random unless this function is user-defined).
   */
  async chooseNPokemon(pokemon: PlayerPokemonView[], n: number): Promise<PlayerPokemonView[]> {
    return this.chooseN(pokemon, n);
  }

  /**
   * View some cards (e.g., from deck, discard pile, etc.). By default, does nothing.
   */
  async viewCards(cards: PlayingCard[]): Promise<void> {}

  /**
   * Distribute a selection of energy among given Pokémon. By default, distributes randomly.
   *
   * @returns An array of Energy arrays, where each array corresponds to the energies assigned to
   * the Pokémon at the same index.
   */
  async distributeEnergy(pokemon: PlayerPokemonView[], energy: Energy[]): Promise<Energy[][]> {
    const distribution: Energy[][] = pokemon.map(() => []);
    for (const en of energy) {
      randomElement(distribution).push(en);
    }
    return distribution;
  }
}
