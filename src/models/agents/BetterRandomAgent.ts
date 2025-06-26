import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
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

export class BetterRandomAgent implements PlayerAgent {
  Name: string = "Better Random Agent";
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

    return {
      active: basicPokemon[0],
      bench: basicPokemon.slice(1, 4),
    };
  }

  async doTurn(game: PlayerGameView) {
    let ownPokemon = [game.selfActive, ...game.selfBenched].filter(
      (x) => x !== undefined
    );

    // Play Professor's Research if available
    const professor = game.selfHand.find(
      (x) => x.Name == "Professor's Research"
    );
    if (professor) {
      await game.playSupporterCard(professor as SupporterCard);
    } else if (Math.random() > 0.5) {
      // Play a random Supporter card if available
      const supporterCards = game.selfHand.filter(
        (x) => x.CardType == "Supporter"
      ) as SupporterCard[];
      if (supporterCards.length > 0) {
        const randomSupporter = rand(supporterCards);
        await game.playSupporterCard(randomSupporter);
      }
    }

    // Play any Poke Balls
    let pokeBall;
    while ((pokeBall = game.selfHand.find((x) => x.Name == "Poké Ball"))) {
      await game.playItemCard(pokeBall as ItemCard);
    }

    // Play random Basic Pokemon to the Bench if available
    const handBasics = game.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    const bench = game.selfBench;
    for (let i = 0; i < 3 && handBasics.length > 0; i++) {
      if (bench[i] == undefined) {
        const randomBasic = rand(handBasics);
        await game.playPokemonToBench(randomBasic, i);
        handBasics.splice(handBasics.indexOf(randomBasic), 1);
      }
    }

    // Play each held Item card with 50% chance
    const itemCards = game.selfHand.filter(
      (x) => x.CardType == "Item"
    ) as ItemCard[];
    for (const card of itemCards) {
      if (Math.random() < 0.5) continue;
      await game.playItemCard(card);
    }

    // Retreat with 100% chance if retreat cost is 0; 50% chance if cost is reduced; 12.5% chance if cost is normal
    if (game.canRetreat()) {
      if (
        game.retreatCostModifier < 0
          ? (game.selfActive!.RetreatCost ?? 0) + game.retreatCostModifier <=
              0 || Math.random() < 0.5
          : Math.random() <
            Math.pow(0.5, (game.selfActive!.RetreatCost ?? 0) + 2)
      ) {
        const randomBench = rand(game.selfBenched);
        await game.retreatActivePokemon(randomBench);
      }
    }

    // Evolve a random Pokemon if possible
    const evolveablePokemon = ownPokemon.filter((x) => x.ReadyToEvolve);
    const pokemonToEvolveWith = game.selfHand.filter(
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
      await game.playPokemonToEvolve(randomEvolver, randomEvolvee);
    }

    ownPokemon = [game.selfActive, ...game.selfBenched].filter(
      (x) => x !== undefined
    );

    // Play energy
    const pokemonNeedingEnergy = ownPokemon.filter((p) => {
      const allAttacks = p.Attacks.slice();
      let currentPokemon = [p.Name];
      while (currentPokemon.length > 0) {
        const nextEvolutions: PokemonCard[] = [];
        for (const pokemon of currentPokemon) {
          for (const potentialEvolution of game.selfHand.concat(
            game.selfDeck
          )) {
            if (
              potentialEvolution.CardType == "Pokemon" &&
              potentialEvolution.EvolvesFrom == pokemon
            ) {
              allAttacks.push(...potentialEvolution.Attacks);
              nextEvolutions.push(potentialEvolution);
            }
          }
        }
        currentPokemon = nextEvolutions
          .map((x) => x.Name)
          .filter((x, i, a) => a.indexOf(x) === i);
      }

      for (const attack of allAttacks) {
        const modifiedEnergy = attack.RequiredEnergy.slice();
        for (const e1 of p.AttachedEnergy)
          modifiedEnergy.splice(
            modifiedEnergy.findIndex((e2) => e2 == e1 || e2 == "Colorless"),
            1
          );
        if (
          modifiedEnergy.some(
            (e) => e == game.selfAvailableEnergy || e == "Colorless"
          )
        )
          return true;
      }
      return false;
    });
    if (
      pokemonNeedingEnergy.includes(game.selfActive!) ||
      pokemonNeedingEnergy.length == 0
    ) {
      await game.attachAvailableEnergy(game.selfActive!);
    } else {
      const randomPokemon =
        pokemonNeedingEnergy[
          Math.floor(Math.random() * pokemonNeedingEnergy.length)
        ];
      await game.attachAvailableEnergy(randomPokemon);
    }

    // End turn with a random attack
    const attacks = [];
    for (const attack of game.selfActive?.Attacks ?? []) {
      if (game.canUseAttack(attack)) attacks.push(attack);
    }
    if (attacks.length > 0) {
      const randomAttack = rand(attacks);
      await game.useAttack(randomAttack);
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
}
