import type {
  Attack,
  Energy,
  GameInitState,
  ItemCard,
  PlayerGameView,
  PlayerPokemonView,
  PokemonCard,
  SupporterCard,
} from "../../gamelogic";
import { PlayerAgent } from "../../gamelogic";
import { randomElement as rand, removeElement } from "../../util";

export class BetterRandomAgent extends PlayerAgent {
  async setupPokemon(game: GameInitState) {
    const basicPokemon = game.hand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];

    return {
      active: basicPokemon[0]!,
      bench: basicPokemon.slice(1, 4),
    };
  }

  async doTurn(game: PlayerGameView) {
    let ownPokemon = game.selfInPlayPokemon;

    // Play Professor's Research if available
    const professor = game.selfHand.find((x) => x.Name == "Professor’s Research");
    let endTurnSupporter: SupporterCard | null = null;
    if (professor) {
      await game.playSupporterCard(professor as SupporterCard);
    } else if (Math.random() > 0.5) {
      // Play a random Supporter card if available
      const supporterCards = game.selfHand.filter(
        (x) => x.CardType == "Supporter" && game.canPlayCard(x)
      ) as SupporterCard[];
      if (supporterCards.length > 0) {
        const card = rand(supporterCards);
        if (card.Text.includes("Your turn ends")) {
          endTurnSupporter = card;
        } else {
          let target: PlayerPokemonView | undefined;
          if (card.Effect.type === "Targeted") {
            target = rand(game.validTargets(card));
          }
          await game.playSupporterCard(card, target);
        }
      }
    }

    // Play any Poke Balls
    let pokeBall;
    while (
      (pokeBall = game.selfHand.find((x) => x.Name == "Poké Ball")) &&
      game.canPlayCard(pokeBall)
    ) {
      await game.playItemCard(pokeBall as ItemCard);
    }

    // Play random Basic Pokemon to the Bench if available
    const handBasics = game.selfHand.filter(
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];
    const bench = game.selfBench;
    for (let i = 0; i < 3 && handBasics.length > 0; i++) {
      if (!bench[i]!.isPokemon) {
        const randomBasic = rand(handBasics);
        await game.playPokemonToBench(randomBasic, i);
        removeElement(handBasics, randomBasic);
      }
    }

    // Play each held Item card with 50% chance
    const itemCards = game.selfHand.filter((x) => x.CardType == "Item" || x.CardType == "Fossil");
    for (const card of itemCards) {
      if (!game.canPlayCard(card) || Math.random() < 0.5) continue;
      if (card.CardType === "Fossil") {
        await game.playFossilCard(card, rand(game.validTargets(card)));
      } else {
        let target: PlayerPokemonView | undefined;
        if (card.Effect.type === "Targeted") {
          target = rand(game.validTargets(card));
        }
        await game.playItemCard(card, target);
      }
    }

    // Play each held Pokemon Tool card with 50% chance
    const toolCards = game.selfHand.filter((x) => x.CardType == "PokemonTool");
    for (const card of toolCards) {
      if (!game.canPlayCard(card) || Math.random() < 0.5) continue;
      const validTargets = game.validTargets(card) as PlayerPokemonView[];
      if (validTargets.length == 0) continue;
      const target = rand(validTargets);
      await game.playPokemonToolCard(card, target);
    }

    // Retreat with 100% chance if retreat cost is reduced to 0; 50% chance if cost is reduced
    // but positive; 25% chance times another 50% for each energy required if cost is normal
    if (game.canRetreat()) {
      if (
        game.retreatCostModifier < 0
          ? game.selfActive.RetreatCost + game.retreatCostModifier <= 0 || Math.random() < 0.5
          : Math.random() < Math.pow(0.5, game.selfActive.RetreatCost + 2)
      ) {
        const randomBench = rand(this.bestPokemonToSwapInto(game));
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

    ownPokemon = game.selfInPlayPokemon;

    // If any Pokemon has a usable Ability, use it
    const pokemonWithAbilities = ownPokemon.filter(
      (x) => x.Ability && game.canUseAbility(x, x.Ability)
    );
    let endTurnAbilityPokemon: PlayerPokemonView | null = null;
    for (const pokemon of pokemonWithAbilities) {
      // Fossils are given a pseudo-Ability to discard themselves; don't use it unless in the Active Spot
      if (pokemon.RetreatCost === -1 && pokemon != game.selfActive) continue;

      if (pokemon.Ability!.text.includes("your turn ends")) {
        endTurnAbilityPokemon = pokemon;
        continue;
      }

      await game.useAbility(pokemon, pokemon.Ability!);
    }

    ownPokemon = game.selfInPlayPokemon;

    const active = game.selfActive;
    if (!active.isPokemon) return;

    // Play energy
    if (
      game.canAttachFromEnergyZone(active) &&
      active.Attacks.some((a) =>
        this.findRemainingEnergy(active, game.findEffectiveAttackCost(a)).some(
          (e) => e == game.selfAvailableEnergy || e == "Colorless"
        )
      )
    ) {
      // If the active Pokemon needs the available energy for any attack, attach it
      await game.attachAvailableEnergy(active);
    } else {
      // Otherwise, check the energy needs of all Pokemon on the field and their evolutions
      const pokemonEnergyRequirements = ownPokemon.map((p) => {
        const allPokemon = [p, ...this.findPotentialEvolutions(game, p)];
        const allAttacks = allPokemon.flatMap((x) => x.Attacks);
        let maxEnergyRequired = 0;

        for (const attack of allAttacks) {
          const remainingEnergy = this.findRemainingEnergy(p, game.findEffectiveAttackCost(attack));
          if (
            remainingEnergy.length > maxEnergyRequired &&
            remainingEnergy.some((e) => e == game.selfAvailableEnergy || e == "Colorless")
          )
            maxEnergyRequired = remainingEnergy.length;
        }
        return { pokemon: p, maxEnergyRequired };
      });

      const pokemonNeedingExtraEnergy = pokemonEnergyRequirements.filter(
        (x) => x.maxEnergyRequired >= 2
      );
      const pokemonNeedingSomeEnergy = pokemonEnergyRequirements.filter(
        (x) => x.maxEnergyRequired >= 1
      );
      if (pokemonNeedingExtraEnergy.length > 0) {
        // If any Pokemon need 2 or more energy, attach to one of them at random
        // This way we don't waste energy on Pokemon that will be able to attack on the turn they switch in
        if (pokemonNeedingExtraEnergy.some((x) => x.pokemon == game.selfActive)) {
          // If the active Pokemon needs extra energy, attach to it first
          await game.attachAvailableEnergy(active);
        } else {
          const randomPokemon = rand(pokemonNeedingExtraEnergy).pokemon;
          await game.attachAvailableEnergy(randomPokemon);
        }
      } else if (pokemonNeedingSomeEnergy.length > 0) {
        // If we get to this point and any Pokemon need 1 energy, attach to one of them at random
        const randomPokemon = rand(pokemonNeedingSomeEnergy).pokemon;
        await game.attachAvailableEnergy(randomPokemon);
      } else {
        // If no Pokemon need energy, attach to the active Pokemon
        await game.attachAvailableEnergy(active);
      }
    }

    // End turn with the attack with the highest energy cost that can be used
    let chosenAttack: Attack | undefined;
    for (const attack of active.Attacks) {
      if (game.canUseAttack(attack)) chosenAttack = attack;
    }
    if (chosenAttack) {
      await game.useAttack(chosenAttack);
    } else if (endTurnAbilityPokemon) {
      await game.useAbility(endTurnAbilityPokemon, endTurnAbilityPokemon.Ability!);
    } else if (endTurnSupporter) {
      let target: PlayerPokemonView | undefined;
      if (endTurnSupporter.Effect.type === "Targeted") {
        target = rand(game.validTargets(endTurnSupporter));
      }
      await game.playSupporterCard(endTurnSupporter, target);
    }
    return;
  }

  findPotentialEvolutions(game: PlayerGameView, pokemon: PlayerPokemonView) {
    const allPokemon: PokemonCard[] = [];
    let currentPokemon = [pokemon.Name];
    while (currentPokemon.length > 0) {
      const nextEvolutions: PokemonCard[] = [];
      for (const mon of currentPokemon) {
        for (const potentialEvolution of game.selfHand.concat(game.selfDeck)) {
          if (potentialEvolution.CardType == "Pokemon" && potentialEvolution.EvolvesFrom == mon) {
            allPokemon.push(potentialEvolution);
            nextEvolutions.push(potentialEvolution);
          }
        }
      }
      currentPokemon = nextEvolutions.map((x) => x.Name).filter((x, i, a) => a.indexOf(x) === i);
    }
    return allPokemon;
  }

  findRemainingEnergy(pokemon: PlayerPokemonView, cost: Energy[]): Energy[] {
    const remainingEnergy = cost.slice();
    for (const e1 of pokemon.EffectiveEnergy) {
      const index = remainingEnergy.findIndex((e2) => e2 == e1 || e2 == "Colorless");
      if (index >= 0) remainingEnergy.splice(index, 1);
    }
    return remainingEnergy;
  }

  bestPokemonToSwapInto(game: PlayerGameView): PlayerPokemonView[] {
    const bench = game.selfBenched;
    const availableEnergy = game.isSelfTurn ? game.selfAvailableEnergy : game.selfNextEnergy;

    let maxScore = -10;
    const pokemonScores = bench.map((pokemon) => {
      const usableAttacks = pokemon.Attacks.filter((a) => {
        const energy = this.findRemainingEnergy(pokemon, game.findEffectiveAttackCost(a));
        if (energy.length == 0) return true;
        if (
          energy.length == 1 &&
          availableEnergy &&
          (energy[0] == "Colorless" || energy[0] == availableEnergy)
        )
          return true;
        return false;
      });

      const baseScore =
        pokemon.Stage +
        pokemon.PrizePoints +
        (game.opponentActive.isPokemon && game.opponentActive.Weakness == pokemon.Type ? 1 : 0);
      let score = baseScore - 10;
      usableAttacks.forEach((attack) => {
        const newScore = game.findEffectiveAttackCost(attack).length + baseScore;

        if (newScore > score) {
          score = newScore;
        }
      });
      if (score > maxScore) maxScore = score;

      return { pokemon, score };
    });

    return pokemonScores.filter((x) => x.score == maxScore).map((x) => x.pokemon);
  }
}
