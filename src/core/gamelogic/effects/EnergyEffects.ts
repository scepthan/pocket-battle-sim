import { randomElement, sortedBy } from "@/core/util";
import type { InPlayPokemon } from "../InPlayPokemon";
import type { Player } from "../Player";
import { allEnergies, type Energy } from "../types";

export const changeRandomEnergy = (player: Player, target: InPlayPokemon, options: Energy[]) => {
  if (target.AttachedEnergy.length === 0) {
    player.logger.noValidTargets(player);
    return;
  }

  const randomIndex = (Math.random() * target.AttachedEnergy.length) | 0;
  const priorEnergy = target.AttachedEnergy[randomIndex]!;
  const newEnergy = randomElement(options);
  target.AttachedEnergy[randomIndex] = newEnergy;
  target.AttachedEnergy = sortedBy(target.AttachedEnergy, (e) => e, allEnergies);
  player.logger.changeAttachedEnergy(player, target, priorEnergy, newEnergy);
};
