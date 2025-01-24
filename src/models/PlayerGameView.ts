import type { PlayingCard } from "@/types/PlayingCard";
import type { GameState } from "./GameState";
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
  get selfBenched() {
    return this.#player.BenchedPokemon.slice();
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
  get opponentBenched() {
    return this.#opponent.BenchedPokemon.slice();
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
        return currPokemon.some((pokemon) => pokemon?.EvolvesFrom == card.Name);
      }
    } else if (card.CardType == "Supporter") {
      return this.canPlaySupporter;
    } else if (card.CardType == "Item") {
      // There are definitely special cases but I haven't decided how these cards will work yet so
      return true;
    }
  }
}
