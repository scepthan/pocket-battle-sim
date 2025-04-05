import type { Energy, Move, PlayingCard, PokemonCard } from "@/types";
import type { GameState } from "./GameState";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Player } from "./Player";

export class PlayerGameView {
  #gameState: GameState;
  #player: Player;
  #opponent: Player;

  constructor(gameState: GameState, player: Player) {
    this.#gameState = gameState;
    this.#player = player;
    if (player == gameState.Player1) {
      this.#opponent = gameState.Player2;
    } else {
      this.#opponent = gameState.Player1;
    }
  }

  // Game attributes
  get currentTurnNumber() {
    return this.#gameState.TurnNumber;
  }
  get isSelfTurn() {
    return this.#gameState.AttackingPlayer == this.#player;
  }

  // Self attributes
  get selfActive() {
    return this.#player.ActivePokemon;
  }
  get selfBench() {
    return this.#player.Bench.slice();
  }
  get selfBenched() {
    return this.#player.Bench.filter((x) => x) as InPlayPokemonCard[];
  }
  get selfHand() {
    return this.#player.Hand.slice();
  }
  get selfDeck() {
    return this.#player.Deck.slice().sort((a, b) => a.ID.localeCompare(b.ID));
  }
  get selfDiscard() {
    return this.#player.Discard.slice();
  }
  get selfAvailableEnergy() {
    return this.#player.AvailableEnergy;
  }
  get selfNextEnergy() {
    return this.#player.NextEnergy;
  }

  // Opponent attributes
  get opponentActive() {
    return this.#opponent.ActivePokemon;
  }
  get opponentBench() {
    return this.#opponent.Bench.slice();
  }
  get opponentBenched() {
    return this.#opponent.Bench.filter((x) => x) as InPlayPokemonCard[];
  }
  get opponentHandSize() {
    return this.#opponent.Hand.length;
  }
  get opponentDeckSize() {
    return this.#opponent.Deck.length;
  }
  get opponentDiscard() {
    return this.#opponent.Discard.slice();
  }
  get opponentAvailableEnergy() {
    // Necessary? Maybe for making swap decisions while defending
    return this.#opponent.AvailableEnergy;
  }
  get opponentNextEnergy() {
    return this.#opponent.NextEnergy;
  }

  get canPlaySupporter() {
    return this.#gameState.CanPlaySupporter;
  }

  // Helper methods
  canPlayCard(card: PlayingCard) {
    if (!this.isSelfTurn) return false;

    if (card.CardType == "Pokemon") {
      if (card.Stage == 0) {
        const bench = this.selfBenched;
        return !bench[0] || !bench[1] || !bench[2];
      } else {
        const currPokemon = [this.selfActive, ...this.selfBenched];
        return currPokemon.some((pokemon) => card.EvolvesFrom == pokemon?.Name);
      }
    } else if (card.CardType == "Supporter") {
      return this.canPlaySupporter;
    } else if (card.CardType == "Item") {
      // There are definitely special cases but I haven't decided how these cards will work yet so
      return true;
    }
  }
  canUseAttack(attack: Move) {
    if (!this.isSelfTurn || !this.selfActive) return false;
    if (!this.selfActive.Moves.includes(attack)) return false;
    const energyAvailable = this.selfActive.AttachedEnergy.slice();
    for (const energy of attack.RequiredEnergy) {
      if (energy === "Colorless" && energyAvailable.length > 0) {
        energyAvailable.pop();
      } else if (energyAvailable.includes(energy)) {
        energyAvailable.splice(energyAvailable.indexOf(energy), 1);
      } else {
        return false;
      }
    }
    return true;
  }
  canRetreat() {
    if (!this.isSelfTurn || !this.selfActive) return false;
    if (this.selfBenched.length == 0) return false;
    return (
      (this.selfActive.RetreatCost ?? 0) <=
      this.selfActive.AttachedEnergy.length
    );
  }

  // Action methods
  async attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.isSelfTurn) return false;
    if (this.selfAvailableEnergy) {
      this.#player.attachAvailableEnergy(pokemon);
      return true;
    }
    return false;
  }
  async playPokemonToBench(pokemon: PokemonCard, index: number) {
    if (!this.isSelfTurn) return false;
    if (pokemon.Stage == 0 && this.selfBench[index] == undefined) {
      this.#player.putPokemonOnBench(pokemon, index);
      return true;
    }
    return false;
  }
  async playPokemonToEvolve(
    pokemon: PokemonCard,
    inPlayPokemon: InPlayPokemonCard
  ) {
    if (!this.isSelfTurn) return false;
    if (pokemon.EvolvesFrom == inPlayPokemon.Name) {
      this.#player.evolvePokemon(inPlayPokemon, pokemon);
      return true;
    }
    return false;
  }
  async useAttack(attack: Move) {
    if (!this.canUseAttack(attack)) return false;
    this.#gameState.useAttack(attack);
    return true;
  }
  async retreatActivePokemon(
    benchedPokemon: InPlayPokemonCard,
    energy?: Energy[]
  ) {
    if (!this.canRetreat()) return false;
    if (!energy)
      energy = this.selfActive!.AttachedEnergy.slice(
        0,
        this.selfActive!.RetreatCost
      );
    this.#player.retreatActivePokemon(benchedPokemon, energy);
    return true;
  }
}
