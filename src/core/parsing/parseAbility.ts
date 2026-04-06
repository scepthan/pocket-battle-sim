import type { Ability, StatusAbilityEffect } from "../gamelogic";
import { statusesToSideEffects } from "./EffectParser";
import { parseEffect } from "./parseEffect";
import type { InputCardAbility, ParsedResult } from "./types";

export const parseAbility = (
  inputAbility: InputCardAbility,
  source: "Ability" | "PokemonTool",
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
          coinsToFlip: effect.passedAmount,
          sideEffects: [...effect.sideEffects, ...statusesToSideEffects(effect)],
        },
      },
    };
  } else {
    const abilityEffects: StatusAbilityEffect[] = [];
    for (const status of effect.selfPokemonStatuses) {
      abilityEffects.push({
        type: "PokemonStatus",
        status: Object.assign({}, status),
      });
    }
    for (const status of effect.selfPlayerStatuses) {
      abilityEffects.push({
        type: "PlayerStatus",
        status: Object.assign({}, status),
        opponent: false,
      });
    }
    for (const status of effect.opponentPlayerStatuses) {
      abilityEffects.push({
        type: "PlayerStatus",
        status: Object.assign({}, status),
        opponent: true,
      });
    }

    if (abilityEffects.length === 0) {
      if (effect.opponentPokemonStatuses.length > 0)
        console.error("Failed to create Ability for opponent Pokémon status", effect);
      parseSuccessful = false;

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
    }

    for (const abilityEffect of abilityEffects) {
      abilityEffect.status.source = source;
    }
    const conditions = [...effect.explicitConditions, ...effect.implicitConditions];
    if (effect.statusConditional) {
      const conditional = effect.statusConditional;
      conditions.push((player, pokemon) => conditional(player.game, pokemon, 0));
    }

    return {
      parseSuccessful,
      value: {
        name: inputAbility.name,
        text: inputAbility.text,
        type: "Status",
        effect: abilityEffects,
        conditions,
      },
    };
  }
};
