import { parseEnergy, type Energy } from "../gamelogic";

export const parseEnergies = (text: string): Energy[] => {
  const energyMatches = text.matchAll(/\{(\w)\}/g);
  const energies: Energy[] = [];
  for (const match of energyMatches) {
    energies.push(parseEnergy(match[1]!));
  }
  return energies;
};
