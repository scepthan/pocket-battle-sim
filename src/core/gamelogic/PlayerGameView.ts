import type {
  Ability,
  Attack,
  Energy,
  ItemCard,
  PlayingCard,
  PokemonCard,
  SupporterCard,
} from "../types";
import type { Game } from "./Game";
import type { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Player } from "./Player";

export class PlayerGameView {
  #gameState: Game;
  #turnNumber: number;
  #player: Player;
  #opponent: Player;

  constructor(gameState: Game, player: Player) {
    this.#gameState = gameState;
    this.#turnNumber = gameState.TurnNumber;
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
  get canPlay() {
    return (
      this.isSelfTurn &&
      this.#gameState.TurnNumber > 0 &&
      this.#gameState.TurnNumber == this.#turnNumber
    );
  }

  // Self attributes
  get selfActive() {
    return this.#player.ActivePokemon;
  }
  get selfBench() {
    return this.#player.Bench.slice();
  }
  get selfBenched() {
    return this.#player.BenchedPokemon;
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
    return this.#opponent.BenchedPokemon;
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
  get retreatCostModifier() {
    return this.#gameState.RetreatCostModifier;
  }

  // Helper methods
  canPlayCard(card: PlayingCard) {
    if (!this.canPlay) return false;

    if (!this.selfHand.includes(card)) {
      return false;
    }

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
  canUseAttack(attack: Attack) {
    if (!this.canPlay || !this.selfActive) return false;
    if (!this.selfActive.Attacks.includes(attack)) return false;
    if (this.selfActive.PrimaryStatus == "Asleep") return false;
    if (this.selfActive.PrimaryStatus == "Paralyzed") return false;
    return this.selfActive.hasSufficientEnergy(attack.RequiredEnergy);
  }
  canUseAbility(pokemon: InPlayPokemonCard, ability: Ability) {
    if (!this.canPlay || !this.selfActive) return false;
    if (pokemon.Ability !== ability) return false;
    if (ability.Trigger == "OnceDuringTurn") {
      if (this.#gameState.UsedAbilities.has(pokemon)) return false;
    }
    if (ability.Conditions.includes("Active")) {
      if (pokemon != this.selfActive) return false;
    }
    if (ability.Conditions.includes("OnBench")) {
      if (!this.selfBenched.includes(pokemon)) return false;
    }
    if (ability.Conditions.includes("HasDamage")) {
      if (pokemon.CurrentHP == pokemon.BaseHP) return false;
    }
    return true;
  }
  canRetreat() {
    if (!this.canPlay || !this.selfActive) return false;
    if (this.selfBenched.length == 0) return false;
    if (this.selfActive.RetreatCost == -1) return false;
    if (this.selfActive.PrimaryStatus == "Asleep") return false;
    if (this.selfActive.PrimaryStatus == "Paralyzed") return false;
    return (
      this.selfActive.RetreatCost + this.retreatCostModifier <=
      this.selfActive.AttachedEnergy.length
    );
  }

  // Action methods
  async attachAvailableEnergy(pokemon: InPlayPokemonCard) {
    if (!this.canPlay) return false;

    if (this.selfAvailableEnergy) {
      await this.#gameState.delay();
      this.#player.attachAvailableEnergy(pokemon);
      return true;
    }
    return false;
  }
  async playPokemonToBench(pokemon: PokemonCard, index: number) {
    if (!this.canPlay) return false;

    if (pokemon.Stage == 0 && this.selfBench[index] == undefined) {
      await this.#gameState.delay();
      this.#player.putPokemonOnBench(pokemon, index);
      return true;
    }
    return false;
  }
  async playPokemonToEvolve(pokemon: PokemonCard, inPlayPokemon: InPlayPokemonCard) {
    if (!this.canPlay) return false;

    if (pokemon.EvolvesFrom == inPlayPokemon.Name) {
      await this.#gameState.delay();
      this.#player.evolvePokemon(inPlayPokemon, pokemon);
      return true;
    }
    return false;
  }
  async useAbility(pokemon: InPlayPokemonCard, ability: Ability) {
    if (!this.canUseAbility(pokemon, ability)) return false;
    await this.#gameState.delay();

    await this.#gameState.useAbility(pokemon, ability);
    return true;
  }
  async useAttack(attack: Attack) {
    if (!this.canUseAttack(attack)) return false;
    await this.#gameState.delay();

    await this.#gameState.useAttack(attack);
    return true;
  }
  async retreatActivePokemon(benchedPokemon: InPlayPokemonCard, energy?: Energy[]) {
    if (!this.canRetreat()) return false;
    await this.#gameState.delay();

    if (!energy) {
      let retreatCost = this.selfActive!.RetreatCost ?? 0;
      retreatCost += this.retreatCostModifier;
      if (retreatCost < 0) retreatCost = 0;
      energy = this.selfActive!.AttachedEnergy.slice(0, retreatCost);
    }

    this.#player.retreatActivePokemon(benchedPokemon, energy, this.#gameState.RetreatCostModifier);
    return true;
  }
  async playItemCard(card: ItemCard) {
    if (!this.canPlayCard(card)) return false;
    await this.#gameState.delay();

    await this.#gameState.playTrainer(card);
    return true;
  }
  async playSupporterCard(card: SupporterCard) {
    if (!this.canPlayCard(card)) return false;
    await this.#gameState.delay();

    await this.#gameState.playTrainer(card);
    return true;
  }
}
