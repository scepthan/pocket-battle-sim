import type { Ability, StatusAbilityEffect } from "../gamelogic";
import { parseEffect, statusesToSideEffects } from "./parseEffect";
import type { InputCardAbility, ParsedResult } from "./types";

export const parseAbility = (
  inputAbility: InputCardAbility,
  source: "Ability" | "PokemonTool"
): ParsedResult<Ability> => {
  let parseSuccessful = true;

  const result = parseEffect(inputAbility.text);
  if (!result.parseSuccessful) parseSuccessful = false;
  const effect = result.value;

  if (effect.trigger) {
    return {
      parseSuccessful,
      value: {
        name: inputAbility.name,
        text: inputAbility.text,
        type: "Standard",
        trigger: effect.trigger,
        conditions: [...effect.explicitConditions, ...effect.implicitConditions],
        effect: {
          ...(effect.validTargets
            ? { type: "Targeted", validTargets: effect.validTargets }
            : { type: "Standard" }),
          coinsToFlip: effect.coinsToFlip,
          sideEffects: [...effect.sideEffects, ...statusesToSideEffects(effect)],
        },
      },
    };
  } else {
    let abilityEffect: StatusAbilityEffect | undefined;
    if (effect.selfPokemonStatuses.length === 1) {
      abilityEffect = {
        type: "PokemonStatus",
        status: Object.assign({}, effect.selfPokemonStatuses[0]!),
      };
    } else if (effect.selfPlayerStatuses.length === 1) {
      abilityEffect = {
        type: "PlayerStatus",
        status: Object.assign({}, effect.selfPlayerStatuses[0]!),
        opponent: false,
      };
    } else if (effect.opponentPlayerStatuses.length === 1) {
      abilityEffect = {
        type: "PlayerStatus",
        status: Object.assign({}, effect.opponentPlayerStatuses[0]!),
        opponent: true,
      };
    } else {
      if (statusesToSideEffects(effect).length > 0)
        console.error("Multiple ability statuses:", effect);
      parseSuccessful = false;
    }
    if (abilityEffect) {
      abilityEffect.status.source = source;
      return {
        parseSuccessful,
        value: {
          name: inputAbility.name,
          text: inputAbility.text,
          type: "Status",
          effect: abilityEffect,
          conditions: [...effect.explicitConditions, ...effect.implicitConditions],
        },
      };
    }
  }

  return {
    parseSuccessful,
    value: {
      name: inputAbility.name,
      text: inputAbility.text,
      type: "Standard",
      trigger: { type: "Manual", multiUse: false },
      conditions: [],
      effect: {
        type: "Standard",
        sideEffects: [async (game) => game.GameLog.notImplemented(game.AttackingPlayer)],
      },
    },
  };
};
