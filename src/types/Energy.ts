export const EnergyMap = {
  C: "Colorless",
  G: "Grass",
  R: "Fire",
  W: "Water",
  L: "Lightning",
  P: "Psychic",
  F: "Fighting",
  D: "Darkness",
  M: "Metal",
  X: "Dragon",
} as const;
export type EnergyShort = keyof typeof EnergyMap;
export type Energy = (typeof EnergyMap)[EnergyShort];

export const isEnergyShort = (E: string): E is EnergyShort =>
  Object.keys(EnergyMap).includes(E);
export const isEnergy = (E: string): E is Energy =>
  Object.values(EnergyMap as Record<string, string>).includes(E);
/**
 * Parses a string to an Energy type, throwing an error if the input is not a valid type.
 * @param E Energy type as string, either full name or short code
 * @throws Error if the energy type is invalid
 * @returns Energy type corresponding to input string
 */
export const parseEnergy = (E: string): Energy => {
  if (isEnergy(E)) return E;
  if (isEnergyShort(E)) return EnergyMap[E];
  throw new Error(`Invalid energy type: ${E}`);
};
