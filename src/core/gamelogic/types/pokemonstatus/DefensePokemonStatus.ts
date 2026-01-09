import type { ParsedResult } from "@/core/parsing";
import { parsePokemonPredicate } from "@/core/parsing/parsePredicates";
import type { PokemonDescriptor } from "../Effects";
import type { BasePokemonStatus } from "./PokemonStatus";

// Statuses that affect incoming attacks
interface BaseDefensePokemonStatus extends BasePokemonStatus {
  attackerCondition?: PokemonDescriptor;
}

interface ModifyIncomingAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "ModifyIncomingAttackDamage";
  amount: number;
}
interface ModifyIncomingAttackDamageOnCoinFlipPokemonStatus extends BaseDefensePokemonStatus {
  type: "ModifyIncomingAttackDamageOnCoinFlip";
  amount: number;
}
interface PreventAttackDamagePokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackDamage";
}
interface PreventAttackEffectsPokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackEffects";
}
interface PreventAttackDamageAndEffectsPokemonStatus extends BaseDefensePokemonStatus {
  type: "PreventAttackDamageAndEffects";
}
interface CounterAttackPokemonStatus extends BaseDefensePokemonStatus {
  type: "CounterAttack";
  amount: number;
}

export type DefensePokemonStatus =
  | ModifyIncomingAttackDamagePokemonStatus
  | ModifyIncomingAttackDamageOnCoinFlipPokemonStatus
  | PreventAttackDamagePokemonStatus
  | PreventAttackEffectsPokemonStatus
  | PreventAttackDamageAndEffectsPokemonStatus
  | CounterAttackPokemonStatus;

const parseAttackerCondition = (pokemonStatus: DefensePokemonStatus, descriptor?: string) => {
  let parseSuccessful = true;
  if (descriptor) {
    const result = parsePokemonPredicate(descriptor);
    parseSuccessful = result.parseSuccessful;
    pokemonStatus.attackerCondition = {
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

export const DefensePokemonStatus = {
  ModifyIncomingAttackDamage: (amount: number, turnsToKeep?: number, descriptor?: string) =>
    parseAttackerCondition(
      { type: "ModifyIncomingAttackDamage", source, turnsToKeep, amount },
      descriptor
    ),
  ModifyIncomingAttackDamageOnCoinFlip: (
    amount: number,
    turnsToKeep?: number,
    descriptor?: string
  ) =>
    parseAttackerCondition(
      { type: "ModifyIncomingAttackDamageOnCoinFlip", source, turnsToKeep, amount },
      descriptor
    ),
  PreventAttackDamage: (turnsToKeep?: number, descriptor?: string) =>
    parseAttackerCondition({ type: "PreventAttackDamage", source, turnsToKeep }, descriptor),
  PreventAttackEffects: (turnsToKeep?: number, descriptor?: string) =>
    parseAttackerCondition({ type: "PreventAttackEffects", source, turnsToKeep }, descriptor),
  PreventAttackDamageAndEffects: (turnsToKeep?: number, descriptor?: string) =>
    parseAttackerCondition(
      { type: "PreventAttackDamageAndEffects", source, turnsToKeep },
      descriptor
    ),
  CounterAttack: (amount: number, turnsToKeep?: number, descriptor?: string) =>
    parseAttackerCondition({ type: "CounterAttack", source, turnsToKeep, amount }, descriptor),
} satisfies Record<string, (...args: never) => ParsedResult<DefensePokemonStatus>>;
