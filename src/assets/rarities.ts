export const allRarities = {
  C: { name: "Common", icon: "Diamond", count: 1 },
  U: { name: "Uncommon", icon: "Diamond", count: 2 },
  R: { name: "Rare", icon: "Diamond", count: 3 },
  RR: { name: "Double Rare", icon: "Diamond", count: 4 },
  AR: { name: "Art Rare", icon: "Star", count: 1 },
  SR: { name: "Super Rare", icon: "Star", count: 2 },
  SAR: { name: "Special Art Rare", icon: "Star", count: 2 },
  IM: { name: "Immersive Rare", icon: "Star", count: 3 },
  S: { name: "Shiny", icon: "Shiny", count: 1 },
  SSR: { name: "Shiny Super Rare", icon: "Shiny", count: 2 },
  UR: { name: "Crown Rare", icon: "Crown", count: 1 },
} as const;

export const rarityShort = Object.keys(allRarities) as (keyof typeof allRarities)[];
