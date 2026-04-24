import { randomElement, sortedBy } from "@/core/util";
import type { InPlayPokemon } from "../InPlayPokemon";
import type { Player } from "../Player";
import { allEnergies, type Energy } from "../types";

export const changeRandomEnergy = (player: Player, target: InPlayPokemon, options: Energy[]) => {
  if (target.attachedEnergy.length === 0) {
    player.logger.noValidTargets(player);
    return;
  }

  const randomIndex = (Math.random() * target.attachedEnergy.length) | 0;
  const priorEnergy = target.attachedEnergy[randomIndex]!;
  const newEnergy = randomElement(options);
  target.attachedEnergy[randomIndex] = newEnergy;
  target.attachedEnergy = sortedBy(target.attachedEnergy, (e) => e, allEnergies);
  player.logger.changeAttachedEnergy(player, target, priorEnergy, newEnergy);
};
