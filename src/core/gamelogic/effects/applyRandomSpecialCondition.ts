import { randomElement } from "@/core/util";
import type { InPlayPokemon } from "../InPlayPokemon";

export const applyRandomSpecialCondition = (target: InPlayPokemon) => {
  const game = target.game;
  const currentConditions = target.CurrentConditions.map((cond) => cond.replace(/\+$/, ""));
  const conditions = (["Asleep", "Burned", "Confused", "Paralyzed", "Poisoned"] as const).filter(
    (c) => currentConditions.includes(c),
  );

  const condition = randomElement(conditions);
  if (condition === "Asleep") {
    game.sleepDefendingPokemon();
  } else if (condition === "Burned") {
    game.burnDefendingPokemon();
  } else if (condition === "Confused") {
    game.confuseDefendingPokemon();
  } else if (condition === "Paralyzed") {
    game.paralyzeDefendingPokemon();
  } else if (condition === "Poisoned") {
    game.poisonDefendingPokemon();
  }
};
