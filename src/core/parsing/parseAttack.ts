import { isEnergyShort, parseEnergy, type Attack, type Energy, type Game } from "../gamelogic";
import { parseAttackEffect } from "./parseAttackEffect";
import type { InputCardAttack, ParsedResult } from "./types";

export const parseAttack = (inputAttack: InputCardAttack): ParsedResult<Attack> => {
  let parseSuccessful = true;
  const Name = inputAttack.name;
  const Text = inputAttack.text;
  const Damage = inputAttack.damage;

  const RequiredEnergy: Energy[] = [];
  for (const E of inputAttack.cost) {
    if (isEnergyShort(E)) RequiredEnergy.push(parseEnergy(E));
    else parseSuccessful = false;
  }

  const defaultEffect = async (game: Game) => {
    game.attackActivePokemon(inputAttack.damage ?? 0);
  };
  if (inputAttack.text) {
    const damaging = !!inputAttack.damage;
    let parseSuccessful = false;
    let Effect = async (game: Game) => {
      if (damaging) {
        await defaultEffect(game);
        game.GameLog.partiallyImplemented(game.AttackingPlayer);
      } else {
        game.GameLog.notImplemented(game.AttackingPlayer);
      }
    };

    const result = parseAttackEffect(inputAttack.text, inputAttack.damage ?? 0, RequiredEnergy);
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
