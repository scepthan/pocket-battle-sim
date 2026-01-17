/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomElement, randomElements } from "@/core/util";
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
  async chooseNewActivePokemon(
    game: PlayerGameView,
    reason: "opponentEffect" | "activeKnockedOut",
  ): Promise<PlayerPokemonView> {
    return this.choosePokemon(game.selfBenched, "Choose a new Active Pokémon.");
  }

  /**
   * Given a list of options presented as strings, choose an element from it. The list is
   * guaranteed to be non-empty.
   *
   * By default, returns a random element.
   */
  async choose(options: string[], prompt: string): Promise<string> {
    return randomElement(options);
  }
  /**
   * Given a list of some Pokémon currently in play, choose one of them. The list is guaranteed to
   * be non-empty.
   *
   * By default, calls `this.chooseNPokemon()` (random unless this function is user-defined).
   */
  async choosePokemon(pokemon: PlayerPokemonView[], prompt: string): Promise<PlayerPokemonView> {
    const output = await this.chooseNPokemon(pokemon, 1, prompt);
    if (output.length !== 1)
      throw new Error("chooseNPokemon(1) did not return exactly one Pokémon");
    return output[0]!;
  }
  /**
   * Given a list of some Pokémon currently in play, choose n of them. The list is guaranteed to be
   * of length > n.
   *
   * By default, returns n random Pokémon.
   */
  async chooseNPokemon(
    pokemon: PlayerPokemonView[],
    n: number,
    prompt: string,
  ): Promise<PlayerPokemonView[]> {
    return randomElements(pokemon, n);
  }
  /**
   * Given a list of playing cards, choose one of them. The list is guaranteed to be non-empty.
   *
   * By default, calls `this.chooseNCards()` (random unless this function is user-defined).
   */
  async chooseCard(cards: PlayingCard[], prompt: string): Promise<PlayingCard> {
    const output = await this.chooseNCards(cards, 1, prompt);
    if (output.length !== 1) throw new Error("chooseNCards(1) did not return exactly one card");
    return output[0]!;
  }
  /**
   * Given a list of playing cards, choose n of them. The list is guaranteed to be of length > n.
   *
   * By default, returns n random cards.
   */
  async chooseNCards(cards: PlayingCard[], n: number, prompt: string): Promise<PlayingCard[]> {
    return randomElements(cards, n);
  }
  /**
   * View some cards (e.g., from deck, discard pile, etc.). By default, does nothing.
   */
  async viewCards(cards: PlayingCard[]): Promise<void> {}

  /**
   * Given a list of Energy, choose n of them. The list is guaranteed to be of length > n.
   *
   * By default, returns n random Energy.
   */
  async chooseNEnergy(energy: Energy[], n: number, prompt: string): Promise<Energy[]> {
    return randomElements(energy, n);
  }

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
