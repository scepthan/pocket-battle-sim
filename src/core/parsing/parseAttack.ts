import { Game, isEnergyShort, parseEnergy, type Attack } from "../gamelogic";
import { parseEffect, statusesToSideEffects } from "./parseEffect";
import type { InputCardAttack, ParsedResult } from "./types";

export const parseAttack = (inputAttack: InputCardAttack): ParsedResult<Attack> => {
  let parseSuccessful = true;
  const attack: Attack = {
    type: inputAttack.damage === undefined ? "NoBaseDamage" : "PredeterminableDamage",
    name: inputAttack.name,
    requiredEnergy: [],
    text: inputAttack.text,
    baseDamage: inputAttack.damage,
    damageSymbol: inputAttack.damageSymbol,
    preDamageEffects: [],
    attackingEffects: [],
    sideEffects: [],
    explicitConditions: [],
  };

  for (const E of inputAttack.cost) {
    if (isEnergyShort(E)) attack.requiredEnergy.push(parseEnergy(E));
    else parseSuccessful = false;
  }

  if (inputAttack.text !== undefined) {
    const result = parseEffect(inputAttack.text, inputAttack.damage, attack.requiredEnergy);
    const effect = result.value;
    attack.type = effect.attackType;
    attack.coinsToFlip = effect.coinsToFlip;
    attack.calculateDamage = effect.calculateDamage;
    attack.validTargets = effect.validTargets;
    attack.preDamageEffects = effect.preDamageEffects;
    attack.attackingEffects = effect.attackingEffects;
    attack.sideEffects = [...effect.sideEffects, ...statusesToSideEffects(effect)];
    attack.explicitConditions = effect.explicitConditions;

    if (!result.parseSuccessful) {
      parseSuccessful = false;
      const anyImplemented =
        inputAttack.damage !== undefined ||
        attack.attackingEffects.length > 0 ||
        attack.sideEffects.length > 0;
      attack.sideEffects.push(async (game: Game) => {
        if (anyImplemented) {
          game.GameLog.partiallyImplemented(game.AttackingPlayer);
        } else {
          game.GameLog.notImplemented(game.AttackingPlayer);
        }
      });
    }
  }

  return {
    parseSuccessful,
    value: attack,
  };
};
