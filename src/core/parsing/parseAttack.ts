import type { Game } from "../gamelogic";
import { type Attack, type Energy, isEnergyShort, parseEnergy } from "../types";
import { parseAttackEffect } from "./parseAttackEffect";
import type { InputCardAttack, ParsedResult } from "./types";

export const parseAttack = (inputAttack: InputCardAttack): ParsedResult<Attack> => {
  let parseSuccessful = true;
  const Name = inputAttack.Name;
  const Text = inputAttack.Effect;
  const Damage = inputAttack.HP;

  const RequiredEnergy: Energy[] = [];
  for (const E of inputAttack.Energy) {
    if (isEnergyShort(E)) RequiredEnergy.push(parseEnergy(E));
    else parseSuccessful = false;
  }

  const defaultEffect = async (game: Game) => {
    game.attackActivePokemon(inputAttack.HP ?? 0);
  };
  if (inputAttack.Effect) {
    const damaging = !!inputAttack.HP;
    let parseSuccessful = false;
    let Effect = async (game: Game) => {
      if (damaging) await defaultEffect(game);
      game.GameLog.addEntry({
        type: "actionFailed",
        player: game.AttackingPlayer.Name,
        reason: damaging ? "partiallyImplemented" : "notImplemented",
      });
    };

    const result = parseAttackEffect(inputAttack.Effect, inputAttack.HP ?? 0, RequiredEnergy);
    if (result.parseSuccessful) {
      parseSuccessful = true;
      Effect = result.value;
    }
    return {
      parseSuccessful,
      value: { Name, RequiredEnergy, Effect, Text, Damage },
    };
  }

  return {
    parseSuccessful,
    value: { Name, RequiredEnergy, Effect: defaultEffect, Text, Damage },
  };
};
