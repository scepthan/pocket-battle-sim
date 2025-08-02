import { useDeckParser } from "@/composables";
import type { GameInitState, InPlayPokemonCard, PlayerAgent, PlayerGameView } from "../gamelogic";
import type { DeckInfo, Energy, ItemCard, PlayingCard, PokemonCard, SupporterCard } from "../types";

const rand = <T>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

export class BetterRandomAgent implements PlayerAgent {
  Name: string = "Better Random Agent";
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
      (x) => x.CardType == "Pokemon" && x.Stage == 0
    ) as PokemonCard[];

    return {
      active: basicPokemon[0],
      bench: basicPokemon.slice(1, 4),
    };
  }

  async doTurn(game: PlayerGameView) {
    let ownPokemon = [game.selfActive, ...game.selfBenched].filter((x) => x !== undefined);

    // Play Professor's Research if available
    const professor = game.selfHand.find((x) => x.Name == "Professor's Research");
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
    const itemCards = game.selfHand.filter((x) => x.CardType == "Item") as ItemCard[];
    for (const card of itemCards) {
      if (Math.random() < 0.5) continue;
      await game.playItemCard(card);
    }

    // Retreat with 100% chance if retreat cost is 0; 50% chance if cost is reduced; 12.5% chance if cost is normal
    if (game.canRetreat()) {
      if (
        game.retreatCostModifier < 0
          ? (game.selfActive!.RetreatCost ?? 0) + game.retreatCostModifier <= 0 ||
            Math.random() < 0.5
          : Math.random() < Math.pow(0.5, (game.selfActive!.RetreatCost ?? 0) + 2)
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

    ownPokemon = [game.selfActive, ...game.selfBenched].filter((x) => x !== undefined);

    // If any Pokemon has a usable Ability, use it
    const pokemonWithAbilities = ownPokemon.filter(
      (x) => x.Ability && game.canUseAbility(x, x.Ability)
    );
    for (const pokemon of pokemonWithAbilities) {
      await game.useAbility(pokemon, pokemon.Ability!);
    }

    // Play energy
    if (
      game.selfActive!.Attacks.some((a) =>
        this.findRemainingEnergy(game.selfActive!, a.RequiredEnergy).some(
          (e) => e == game.selfAvailableEnergy || e == "Colorless"
        )
      )
    ) {
      // If the active Pokemon needs the available energy for any attack, attach it
      await game.attachAvailableEnergy(game.selfActive!);
    } else {
      // Otherwise, check the energy needs of all Pokemon on the field and their evolutions
      const pokemonEnergyRequirements = ownPokemon.map((p) => {
        const allPokemon = [p, ...this.findPotentialEvolutions(game, p)];
        const allAttacks = allPokemon.flatMap((x) => x.Attacks);
        let maxEnergyRequired = 0;

        for (const attack of allAttacks) {
          const remainingEnergy = this.findRemainingEnergy(p, attack.RequiredEnergy);
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
          await game.attachAvailableEnergy(game.selfActive!);
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
        await game.attachAvailableEnergy(game.selfActive!);
      }
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
  async choose<T>(options: T[]) {
    return rand(options);
  }
  async viewCards() {
    //await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  findPotentialEvolutions(game: PlayerGameView, pokemon: InPlayPokemonCard) {
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

  findRemainingEnergy(pokemon: InPlayPokemonCard, cost: Energy[]): Energy[] {
    const remainingEnergy = cost.slice();
    for (const e1 of pokemon.AttachedEnergy) {
      const index = remainingEnergy.findIndex((e2) => e2 == e1 || e2 == "Colorless");
      if (index >= 0) remainingEnergy.splice(index, 1);
    }
    return remainingEnergy;
  }
}
