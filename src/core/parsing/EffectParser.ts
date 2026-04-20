import type {
  InPlayPokemonPredicate,
  PlayerPokemonConditional,
  PlayingCardPredicate,
  PokemonStatus,
  SideEffect,
} from "../gamelogic";
import { PlayerStatus } from "../gamelogic";
import { parsePlayingCardPredicate, parsePokemonPredicate } from "./parsePredicates";
import type { ParsedEffect, ParsedResult } from "./types";

export class EffectParser {
  effect: ParsedEffect = {
    attackType: "NoBaseDamage",
    preDamageEffects: [],
    attackingEffects: [],
    sideEffects: [],
    explicitConditions: [],
    implicitConditions: [],
    selfPokemonStatuses: [],
    opponentPokemonStatuses: [],
    selfPlayerStatuses: [],
    opponentPlayerStatuses: [],
  };
  parseSuccessful = true;
  conditionalForNextEffect: PlayerPokemonConditional | undefined;
  turnsToKeep: number | undefined;

  constructor(hasBaseDamage: boolean) {
    if (hasBaseDamage) {
      this.effect.attackType = "PredeterminableDamage";
    }
  }

  /**
   * Takes an effect and returns a new one that only runs if the previously parsed condition is met.
   *
   * As an example: "Flip a coin. If heads, discard a random card from your opponent's hand."
   *
   * The "If heads," is parsed and stored as conditionalForNextEffect. The parser for "discard a
   * random card" can then call this method to only apply if the coin flip results in heads.
   */
  applyConditionalIfAvailable(effect: SideEffect): SideEffect {
    if (this.conditionalForNextEffect) {
      const prevConditional = this.conditionalForNextEffect;
      this.conditionalForNextEffect = undefined;
      return async (game, self, heads, target) => {
        if (prevConditional(self.player, self, heads)) await effect(game, self, heads, target);
      };
    }
    return effect;
  }

  addSideEffect(sideEffect: SideEffect) {
    this.effect.sideEffects.push(this.applyConditionalIfAvailable(sideEffect));
  }

  cascadeParseFailure<T>(result: ParsedResult<T>): T {
    if (!result.parseSuccessful) this.parseSuccessful = false;
    return result.value;
  }

  parsePokemonPredicate(descriptor: string, predicate?: InPlayPokemonPredicate) {
    return this.cascadeParseFailure(parsePokemonPredicate(descriptor, predicate));
  }
  parsePlayingCardPredicate(descriptor: string, predicate?: PlayingCardPredicate) {
    return this.cascadeParseFailure(parsePlayingCardPredicate(descriptor, predicate));
  }

  addSelfPokemonStatus(pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>) {
    const status =
      "type" in pokemonStatus ? pokemonStatus : this.cascadeParseFailure(pokemonStatus);
    this.effect.selfPokemonStatuses.push(status);
  }
  addOpponentPokemonStatus(pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>) {
    const status =
      "type" in pokemonStatus ? pokemonStatus : this.cascadeParseFailure(pokemonStatus);
    this.effect.opponentPokemonStatuses.push(status);
  }

  parsePokemonPlayerStatus(
    pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>,
    descriptor: string,
    doesNotStack?: boolean,
  ) {
    const status =
      "type" in pokemonStatus ? pokemonStatus : this.cascadeParseFailure(pokemonStatus);
    const keepNextTurn = this.turnsToKeep !== undefined && this.turnsToKeep > 0;
    return this.cascadeParseFailure(
      PlayerStatus.fromPokemonStatus(status, descriptor, keepNextTurn, doesNotStack),
    );
  }

  addSelfPlayerStatus(playerStatus: PlayerStatus | ParsedResult<PlayerStatus>) {
    const status = "type" in playerStatus ? playerStatus : this.cascadeParseFailure(playerStatus);
    this.effect.selfPlayerStatuses.push(status);
  }
  addSelfPlayerPokemonStatus(
    pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>,
    descriptor: string,
    doesNotStack?: boolean,
  ) {
    const playerStatus = this.parsePokemonPlayerStatus(pokemonStatus, descriptor, doesNotStack);
    this.effect.selfPlayerStatuses.push(playerStatus);
  }
  addOpponentPlayerStatus(playerStatus: PlayerStatus | ParsedResult<PlayerStatus>) {
    const status = "type" in playerStatus ? playerStatus : this.cascadeParseFailure(playerStatus);
    this.effect.opponentPlayerStatuses.push(status);
  }
  addOpponentPlayerPokemonStatus(
    pokemonStatus: PokemonStatus | ParsedResult<PokemonStatus>,
    descriptor: string,
    doesNotStack?: boolean,
  ) {
    const playerStatus = this.parsePokemonPlayerStatus(pokemonStatus, descriptor, doesNotStack);
    this.effect.opponentPlayerStatuses.push(playerStatus);
  }

  hasAnyStatuses() {
    return (
      this.effect.selfPokemonStatuses.length > 0 ||
      this.effect.opponentPokemonStatuses.length > 0 ||
      this.effect.selfPlayerStatuses.length > 0 ||
      this.effect.opponentPlayerStatuses.length > 0
    );
  }
}

export const statusesToSideEffects = (effect: ParsedEffect) => {
  const sideEffects: SideEffect[] = [];

  const applyConditionalIfAvailable = (sideEffect: SideEffect) => {
    if (effect.statusConditional) {
      const conditional = effect.statusConditional;
      sideEffects.push(async (game, self, heads, target) => {
        if (conditional(self.player, self, heads)) await sideEffect(game, self, heads, target);
      });
    } else sideEffects.push(sideEffect);
  };

  for (const status of effect.selfPokemonStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      game.applyPokemonStatus(self, Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPokemonStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      game.applyPokemonStatus(self.opponent.activeOrThrow(), Object.assign({}, status));
    });
  }
  for (const status of effect.selfPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.player.applyPlayerStatus(Object.assign({}, status));
    });
  }
  for (const status of effect.opponentPlayerStatuses) {
    applyConditionalIfAvailable(async (game, self) => {
      self.opponent.applyPlayerStatus(Object.assign({}, status));
    });
  }

  return sideEffects;
};
