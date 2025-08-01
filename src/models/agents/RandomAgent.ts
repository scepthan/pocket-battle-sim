import { useDeckParser } from "@/composables";
import type {
  DeckInfo,
  Energy,
  GameInitState,
  ItemCard,
  PlayerAgent,
  PlayingCard,
  PokemonCard,
  SupporterCard,
} from "@/types";
import type { InPlayPokemonCard } from "../InPlayPokemonCard";
import type { PlayerGameView } from "../PlayerGameView";

const rand = <T>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

export class RandomAgent implements PlayerAgent {
  Name: string = "Random Agent";
  EnergyTypes: Energy[];
  Deck: PlayingCard[];

  constructor(name: string, deck: DeckInfo) {
    const { parseDeck } = useDeckParser();

    this.Name = name;
    this.EnergyTypes = deck.EnergyTypes;
    this.Deck = parseDeck(deck.Cards);
  }

  async setupPokemon(gameState: GameInitState) {
    const basicPokemon = gameState.hand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0,
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
    const ownPokemon = [gameState.selfActive, ...gameState.selfBenched].filter(
      (x) => x !== undefined,
    );

    // Attach energy to random Pokemon if available
    if (gameState.selfAvailableEnergy) {
      await gameState.attachAvailableEnergy(rand(ownPokemon));
    }

    // Play a random Basic Pokemon to the Bench if available
    const handBasics = gameState.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0,
    ) as PokemonCard[];
    if (handBasics.length > 0) {
      const randomBasic = rand(handBasics);
      const bench = gameState.selfBench;
      for (let i = 0; i < 3; i++) {
        if (bench[i] == undefined) {
          await gameState.playPokemonToBench(randomBasic, i);
          break;
        }
      }
    }

    // Play each held Item card with 50% chance
    const itemCards = gameState.selfHand.filter((x) => x.CardType == "Item") as ItemCard[];
    for (const card of itemCards) {
      if (Math.random() < 0.5) continue;
      await gameState.playItemCard(card);
    }

    // Play a random Supporter card if available
    const supporterCards = gameState.selfHand.filter(
      (x) => x.CardType == "Supporter",
    ) as SupporterCard[];
    if (supporterCards.length > 0) {
      const randomSupporter = rand(supporterCards);
      await gameState.playSupporterCard(randomSupporter);
    }

    // Retreat with 100% chance if retreat cost is 0; 50% chance if cost is reduced; 12.5% chance if cost is normal
    if (gameState.canRetreat()) {
      if (
        gameState.retreatCostModifier < 0
          ? (gameState.selfActive!.RetreatCost ?? 0) + gameState.retreatCostModifier <= 0 ||
            Math.random() < 0.5
          : Math.random() < 0.125
      ) {
        const randomBench = rand(gameState.selfBenched);
        await gameState.retreatActivePokemon(randomBench);
      }
    }

    // Evolve a random Pokemon if possible
    const evolveablePokemon = ownPokemon.filter((x) => x.ReadyToEvolve);
    const pokemonToEvolveWith = gameState.selfHand.filter(
      (x) =>
        x.CardType == "Pokemon" &&
        x.Stage > 0 &&
        evolveablePokemon.some((y) => y.Name == x.EvolvesFrom),
    ) as PokemonCard[];
    if (pokemonToEvolveWith.length > 0) {
      const randomEvolver = rand(pokemonToEvolveWith);
      const pokemonToEvolveFrom = evolveablePokemon.filter(
        (x) => x.Name == randomEvolver.EvolvesFrom,
      );
      const randomEvolvee = rand(pokemonToEvolveFrom);
      await gameState.playPokemonToEvolve(randomEvolver, randomEvolvee);
    }

    // End turn with a random attack
    const attacks = [];
    for (const attack of gameState.selfActive?.Attacks ?? []) {
      if (gameState.canUseAttack(attack)) attacks.push(attack);
    }
    if (attacks.length > 0) {
      const randomAttack = rand(attacks);
      await gameState.useAttack(randomAttack);
    }
    return;
  }

  async swapActivePokemon(gameState: PlayerGameView) {
    const bench = gameState.selfBenched;
    return rand(bench);
  }
  async choosePokemon(pokemon: InPlayPokemonCard[]) {
    return rand(pokemon);
  }
  async choose<T>(options: T[]) {
    return rand(options);
  }
  async viewCards() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
