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
export type Energy = (typeof EnergyMap)[keyof typeof EnergyMap];

export const isEnergyShort = (E: string): E is EnergyShort =>
  Object.keys(EnergyMap).includes(E);
export const isEnergy = (E: string): E is Energy =>
  Object.values(EnergyMap as Record<string, string>).includes(E);
