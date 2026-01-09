import type { ParsedResult } from "@/core/parsing";
import { parsePokemonPredicate } from "@/core/parsing/parsePredicates";
import type { PokemonDescriptor } from "../Effects";
import type { PokemonStatus } from "../pokemonstatus";
import { GameRulePlayerStatus } from "./GameRulePlayerStatus";

export interface BasePlayerStatus {
  id?: string;
  source: "Effect" | "Ability";
  keepNextTurn?: boolean;
  doesNotStack?: boolean;
}

export interface PokemonPlayerStatus extends BasePlayerStatus {
  type: "PokemonStatus";
  pokemonCondition: PokemonDescriptor;
  pokemonStatus: PokemonStatus;
}

export type PlayerStatus = GameRulePlayerStatus | PokemonPlayerStatus;

export const PlayerStatus = {
  ...GameRulePlayerStatus,

  fromPokemonStatus: (
    pokemonStatus: PokemonStatus,
    descriptor: string,
    doesNotStack: boolean = false
  ): ParsedResult<PlayerStatus> => {
    const predicate = parsePokemonPredicate(descriptor);
    pokemonStatus.source = "PlayerStatus";
    return {
      parseSuccessful: predicate.parseSuccessful,
      value: {
        type: "PokemonStatus",
        source: "Effect",
        pokemonStatus,
        pokemonCondition: {
          descriptor,
          test: predicate.value,
        },
        doesNotStack,
      },
    };
  },
};
