import type { EmptyCardSlot } from "./EmptyCardSlot";
import type { Game } from "./Game";
import { InPlayPokemonCard } from "./InPlayPokemonCard";
import type { Player } from "./Player";
import { PlayerPokemonView } from "./PlayerPokemonView";
import type {
  Ability,
  Attack,
  CardSlot,
  Energy,
  ItemCard,
  PlayingCard,
  PokemonCard,
  SupporterCard,
} from "./types";

const viewOrEmpty = (slot: InPlayPokemonCard | EmptyCardSlot) => {
  if (slot.isPokemon) return new PlayerPokemonView(slot);
  return slot;
};

interface PlayerGameViewWithActivePokemon {
  selfActive: PlayerPokemonView;
}
export class PlayerGameView {
  #game: Game;
  #turnNumber: number; // Safeguard to prevent actions from being executed after the turn has ended
  #player: Player;
  #opponent: Player;

  constructor(game: Game, player: Player) {
    this.#game = game;
    this.#turnNumber = game.TurnNumber;
    this.#player = player;
    if (player == game.Player1) {
      this.#opponent = game.Player2;
    } else {
      this.#opponent = game.Player1;
    }
  }

  #pokemonFromView(view: PlayerPokemonView) {
    for (const pokemon of [...this.#player.InPlayPokemon, ...this.#opponent.InPlayPokemon])
      if (view.is(pokemon)) return pokemon;
    throw new Error("Could not find Pokemon: " + view.Name);
  }

  // Game attributes
  get currentTurnNumber() {
    return this.#game.TurnNumber;
  }
  get isSelfTurn() {
    return this.#game.AttackingPlayer == this.#player;
  }
  get canPlay() {
    return (
      this.isSelfTurn &&
      this.#game.TurnNumber > 0 &&
      this.#game.TurnNumber == this.#turnNumber &&
      !this.#game.GameOver
    );
  }

  // Self attributes
  get selfActive() {
    return viewOrEmpty(this.#player.ActivePokemon);
  }
  get selfBench() {
    return this.#player.Bench.map(viewOrEmpty);
  }
  get selfBenched() {
    return this.#player.BenchedPokemon.map((p) => new PlayerPokemonView(p));
  }
  get selfInPlayPokemon() {
    return this.#player.InPlayPokemon.map((p) => new PlayerPokemonView(p));
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
    return viewOrEmpty(this.#opponent.ActivePokemon);
  }
  get opponentBench() {
    return this.#opponent.Bench.map(viewOrEmpty);
  }
  get opponentBenched() {
    return this.#opponent.BenchedPokemon.map((p) => new PlayerPokemonView(p));
  }
  get opponentInPlayPokemon() {
    return this.#opponent.InPlayPokemon.map((p) => new PlayerPokemonView(p));
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
    return (
      this.#game.CanPlaySupporter &&
      !this.#player.PlayerStatuses.some((status) => status.type == "CannotUseSupporter")
    );
  }
  get retreatCostModifier() {
    return this.#player.PlayerStatuses.reduce(
      (sum, status) => (status.type === "DecreaseRetreatCost" ? sum - status.amount : sum),
      0
    );
  }

  // Helper methods
  hasActivePokemon(): this is PlayerGameViewWithActivePokemon {
    return this.selfActive.isPokemon;
  }
  canPlayCard(card: PlayingCard) {
    if (!this.canPlay) return false;

    if (!this.selfHand.includes(card)) {
      return false;
    }

    if (card.CardType == "Pokemon") {
      if (card.Stage == 0) {
        return this.selfBenched.length < 3;
      } else {
        return this.selfBenched.some((pokemon) => card.EvolvesFrom == pokemon?.Name);
      }
    } else if (card.CardType == "Supporter") {
      if (!this.canPlaySupporter) return false;
      if (card.Effect.type == "Targeted") {
        const validTargets = card.Effect.validTargets(this.#game);
        if (validTargets.length == 0) return false;
      } else if (card.Effect.type == "Conditional") {
        if (!card.Effect.condition(this.#game, this.#player)) return false;
      }
      return true;
    } else if (card.CardType == "Item") {
      if (card.Effect.type == "Targeted") {
        const validTargets = card.Effect.validTargets(this.#game);
        if (validTargets.length == 0) return false;
      } else if (card.Effect.type == "Conditional") {
        if (!card.Effect.condition(this.#game, this.#player)) return false;
      }
      return true;
    }
  }
  canUseAttack(attack: Attack): this is PlayerGameViewWithActivePokemon {
    if (!this.canPlay || !this.hasActivePokemon()) return false;
    if (!this.selfActive.Attacks.includes(attack)) return false;
    if (this.selfActive.PrimaryCondition == "Asleep") return false;
    if (this.selfActive.PrimaryCondition == "Paralyzed") return false;
    if (this.selfActive.PokemonStatuses.some((status) => status.type == "CannotAttack"))
      return false;
    return this.selfActive.hasSufficientEnergy(attack.RequiredEnergy);
  }
  canUseAbility(pokemon: PlayerPokemonView, ability: Ability) {
    if (!this.canPlay) return false;
    if (pokemon.Ability !== ability) return false;
    if (!["OnceDuringTurn", "ManyDuringTurn"].includes(ability.Trigger)) return false;
    if (ability.Conditions.includes("Active")) {
      if (pokemon != this.selfActive) return false;
    }
    if (ability.Conditions.includes("OnBench")) {
      if (!this.selfBenched.includes(pokemon)) return false;
    }
    if (ability.Conditions.includes("HasDamage")) {
      if (!pokemon.isDamaged()) return false;
    }
    const realPokemon = this.#pokemonFromView(pokemon);
    if (ability.Trigger == "OnceDuringTurn") {
      if (this.#game.UsedAbilities.has(realPokemon)) return false;
    }
    return true;
  }
  canRetreat(): this is PlayerGameViewWithActivePokemon {
    if (!this.canPlay || !this.hasActivePokemon()) return false;
    if (this.selfBenched.length == 0) return false;
    if (this.selfActive.RetreatCost == -1) return false;
    if (this.selfActive.PrimaryCondition == "Asleep") return false;
    if (this.selfActive.PrimaryCondition == "Paralyzed") return false;
    if (this.selfActive.PokemonStatuses.some((status) => status.type == "CannotRetreat"))
      return false;
    return (
      this.selfActive.RetreatCost + this.retreatCostModifier <=
      this.selfActive.EffectiveEnergy.length
    );
  }
  canEvolve(pokemon: PlayerPokemonView) {
    if (!this.canPlay) return false;
    if (!pokemon.ReadyToEvolve) return false;
    const realPokemon = this.#pokemonFromView(pokemon);
    if (
      this.#player.PlayerStatuses.some(
        (status) =>
          status.type == "CannotEvolve" && status.appliesToPokemon(realPokemon, this.#game)
      )
    )
      return false;
    return true;
  }
  validTargets(card: ItemCard | SupporterCard): CardSlot[] {
    if (card.Effect.type == "Targeted") {
      return card.Effect.validTargets(this.#game);
    }
    return [];
  }

  // Action methods
  async attachAvailableEnergy(pokemon: PlayerPokemonView) {
    if (!this.canPlay) return false;

    if (this.selfAvailableEnergy) {
      const realPokemon = this.#pokemonFromView(pokemon);
      await this.#game.delay();
      await this.#game.attachAvailableEnergy(realPokemon);
      return true;
    }
    return false;
  }
  async playPokemonToBench(pokemon: PokemonCard, index: number) {
    if (!this.canPlay) return false;

    if (pokemon.Stage == 0 && !this.selfBench[index]?.isPokemon) {
      await this.#game.delay();
      await this.#game.putPokemonOnBench(pokemon, index);
      return true;
    }
    return false;
  }
  async playPokemonToEvolve(pokemon: PokemonCard, inPlayPokemon: PlayerPokemonView) {
    if (!this.canPlay) return false;
    if (!this.canEvolve(inPlayPokemon)) return false;

    if (pokemon.EvolvesFrom == inPlayPokemon.Name) {
      const realPokemon = this.#pokemonFromView(inPlayPokemon);
      await this.#game.delay();
      await this.#game.evolvePokemon(realPokemon, pokemon);
      return true;
    }
    return false;
  }
  async useAbility(pokemon: PlayerPokemonView, ability: Ability) {
    if (!this.canUseAbility(pokemon, ability)) return false;
    await this.#game.delay();

    const realPokemon = this.#pokemonFromView(pokemon);
    await this.#game.useAbility(realPokemon, ability);
    return true;
  }
  async useAttack(attack: Attack) {
    if (!this.canUseAttack(attack)) return false;
    await this.#game.delay();

    await this.#game.useAttack(attack);
    return true;
  }
  async retreatActivePokemon(benchedPokemon: PlayerPokemonView, energy?: Energy[]) {
    if (!this.canRetreat()) return false;
    await this.#game.delay();

    if (!energy) {
      let retreatCost = this.selfActive.RetreatCost;
      retreatCost += this.retreatCostModifier;
      if (retreatCost < 0) retreatCost = 0;
      energy = [];
      let i = 0;
      while (this.selfActive.calculateEffectiveEnergy(energy).length < retreatCost) {
        const nextEnergy = this.selfActive.AttachedEnergy[i++];
        if (!nextEnergy) throw new Error("Not enough energy to retreat");
        energy.push(nextEnergy);
      }
    }

    const realPokemon = this.#pokemonFromView(benchedPokemon);
    await this.#game.retreatActivePokemon(realPokemon, energy);
    return true;
  }
  async playItemCard(card: ItemCard, target?: CardSlot) {
    if (!this.canPlayCard(card)) return false;
    if (card.Effect.type === "Targeted") {
      if (!target || !card.Effect.validTargets(this.#game).includes(target)) return false;
    }
    await this.#game.delay();

    await this.#game.playTrainer(card, target);
    return true;
  }
  async playSupporterCard(card: SupporterCard, target?: CardSlot) {
    if (!this.canPlayCard(card)) return false;
    if (card.Effect.type === "Targeted") {
      if (!target || !card.Effect.validTargets(this.#game).includes(target)) return false;
    }
    await this.#game.delay();

    await this.#game.playTrainer(card, target);
    return true;
  }
}
