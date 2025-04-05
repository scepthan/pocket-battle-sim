import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import type {
  DeckInfo,
  Energy,
  GameInitState,
  PlayerAgent,
  PlayingCard,
  PokemonCard,
} from "@/types";
import type { PlayerGameView } from "../PlayerGameView";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = <T>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

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
    await wait(1000);
    const ownPokemon = [gameState.selfActive, ...gameState.selfBenched].filter(
      (x) => x !== undefined
    );

    if (gameState.selfAvailableEnergy) {
      gameState.attachAvailableEnergy(rand(ownPokemon));
      await wait(1000);
    }

    const handBasics = gameState.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    if (handBasics.length > 0) {
      const randomBasic = rand(handBasics);
      const bench = gameState.selfBenched;
      for (let i = 0; i < 3; i++) {
        if (bench[i] == undefined) {
          gameState.playPokemonToBench(randomBasic, i);
          await wait(1000);
          break;
        }
      }
    }

    if (gameState.canRetreat() && Math.random() < 0.25) {
      const randomBench = rand(gameState.selfBenched);
      gameState.retreatActivePokemon(randomBench);
      await wait(1000);
    }

    const evolveablePokemon = ownPokemon.filter((x) => x.ReadyToEvolve);
    const pokemonToEvolveWith = gameState.selfHand.filter(
      (x) =>
        x.CardType == "Pokemon" &&
        x.Stage > 0 &&
        evolveablePokemon.some((y) => y.Name == x.EvolvesFrom)
    ) as PokemonCard[];
    if (pokemonToEvolveWith.length > 0) {
      const randomEvolver = rand(pokemonToEvolveWith);
      const pokemonToEvolveFrom = evolveablePokemon.filter(
        (x) => x.Name == randomEvolver.EvolvesFrom
      );
      const randomEvolvee = rand(pokemonToEvolveFrom);
      gameState.playPokemonToEvolve(randomEvolver, randomEvolvee);
      await wait(1000);
    }

    const attacks = [];
    for (const attack of gameState.selfActive?.Moves ?? []) {
      if (gameState.canUseAttack(attack)) attacks.push(attack);
    }
    if (attacks.length > 0) {
      const randomAttack = rand(attacks);
      gameState.useAttack(randomAttack);
      await wait(1000);
    }
    return;
  }

  async swapActivePokemon(gameState: PlayerGameView) {
    await wait(1000);
    const bench = gameState.selfBenched.filter((x) => x !== undefined);
    return rand(bench);
  }
}
