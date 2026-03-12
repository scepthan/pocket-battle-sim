interface ActivePokemonDescriptor {
  cardId: string;
  location: "Active";
}
interface BenchPokemonDescriptor {
  cardId: string;
  location: "Bench";
  index: number;
}
export type InPlayPokemonDescriptor = ActivePokemonDescriptor | BenchPokemonDescriptor;
