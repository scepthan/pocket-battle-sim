import type { ParsedResult } from "@/core/parsing";
import { parsePokemonPredicate } from "@/core/parsing/parsePredicates";
import type { PokemonDescriptor } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

interface BaseAttackPokemonStatus extends BasePokemonStatus {
  defenderCondition?: PokemonDescriptor;
}

// Statuses that affect outgoing attacks
interface ModifyAttackDamagePokemonStatus extends BaseAttackPokemonStatus {
  type: "ModifyAttackDamage";
  amount: number;
}
interface ModifyDamageOfAttackPokemonStatus extends BaseAttackPokemonStatus {
  type: "ModifyDamageOfAttack";
  attackName: string;
  amount: number;
}

export type AttackPokemonStatus =
  | ModifyAttackDamagePokemonStatus
  | ModifyDamageOfAttackPokemonStatus;

const parseDefenderCondition = (pokemonStatus: AttackPokemonStatus, descriptor?: string) => {
  let parseSuccessful = true;
  if (descriptor) {
    const result = parsePokemonPredicate(descriptor);
    parseSuccessful = result.parseSuccessful;
    pokemonStatus.defenderCondition = {
      descriptor,
      test: result.value,
    };
  }
  return {
    parseSuccessful,
    value: pokemonStatus,
  };
};
const source = "Effect";

export const AttackPokemonStatus = {
  ModifyAttackDamage: (amount: number, turnsToKeep?: number, descriptor?: string) =>
    parseDefenderCondition({ type: "ModifyAttackDamage", source, turnsToKeep, amount }, descriptor),
  ModifyDamageOfAttack: (
    attackName: string,
    amount: number,
    turnsToKeep?: number,
    descriptor?: string
  ) =>
    parseDefenderCondition(
      { type: "ModifyDamageOfAttack", source, turnsToKeep, attackName, amount },
      descriptor
    ),
} satisfies Record<string, (...args: never) => ParsedResult<AttackPokemonStatus>>;
