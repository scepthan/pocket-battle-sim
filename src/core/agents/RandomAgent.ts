import type { CardSlotView, GameInitState, PlayerGameView, PokemonCard } from "../gamelogic";
import { PlayerAgent } from "../gamelogic";
import { randomElement } from "../util";

export class RandomAgent extends PlayerAgent {
  async setupPokemon(game: GameInitState) {
    const basicPokemon = game.hand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    if (basicPokemon.length === 0) {
      throw new Error("No basic Pokemon in hand");
    }

    return {
      active: basicPokemon[0]!,
      bench: basicPokemon.slice(1, 4),
    };
  }

  async doTurn(game: PlayerGameView) {
    const ownPokemon = game.selfInPlayPokemon;

    // Attach energy to random Pokemon if available
    if (game.selfAvailableEnergy) {
      await game.attachAvailableEnergy(randomElement(ownPokemon));
    }

    // Play a random Basic Pokemon to the Bench if available
    const handBasics = game.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    if (handBasics.length > 0) {
      const randomBasic = randomElement(handBasics);
      const bench = game.selfBench;
      for (let i = 0; i < 3; i++) {
        if (!bench[i]!.isPokemon) {
          await game.playPokemonToBench(randomBasic, i);
          break;
        }
      }
    }

    // Play each held Item card with 50% chance
    const itemCards = game.selfHand.filter((x) => x.CardType == "Item" || x.CardType == "Fossil");
    for (const card of itemCards) {
      if (!game.canPlayCard(card) || Math.random() < 0.5) continue;
      let target: CardSlotView | undefined;
      if (card.Effect.type === "Targeted") {
        target = randomElement(game.validTargets(card));
      }
      await game.playItemCard(card, target);
    }

    // Play a random Supporter card if available
    const supporterCards = game.selfHand
      .filter((x) => x.CardType == "Supporter")
      .filter((x) => game.canPlayCard(x));
    if (supporterCards.length > 0) {
      const card = randomElement(supporterCards);
      let target: CardSlotView | undefined;
      if (card.Effect.type === "Targeted") {
        target = randomElement(game.validTargets(card));
      }
      await game.playSupporterCard(card, target);
    }

    // Retreat with 100% chance if retreat cost is 0; 50% chance if cost is reduced; 12.5% chance if cost is normal
    if (game.canRetreat()) {
      if (
        game.retreatCostModifier < 0
          ? game.selfActive.RetreatCost + game.retreatCostModifier <= 0 || Math.random() < 0.5
          : Math.random() < 0.125
      ) {
        const randomBench = randomElement(game.selfBenched);
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
      const randomEvolver = randomElement(pokemonToEvolveWith);
      const pokemonToEvolveFrom = evolveablePokemon.filter(
        (x) => x.Name == randomEvolver.EvolvesFrom
      );
      const randomEvolvee = randomElement(pokemonToEvolveFrom);
      await game.playPokemonToEvolve(randomEvolver, randomEvolvee);
    }

    const active = game.selfActive;
    if (!active.isPokemon) return;

    // End turn with a random attack
    const attacks = [];
    for (const attack of active.Attacks) {
      if (game.canUseAttack(attack)) attacks.push(attack);
    }
    if (attacks.length > 0) {
      const randomAttack = randomElement(attacks);
      await game.useAttack(randomAttack);
    }
    return;
  }
}
