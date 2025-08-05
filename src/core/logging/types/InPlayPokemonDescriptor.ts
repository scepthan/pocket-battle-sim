interface ActivePokemonDescriptor {
  cardId: string;
  location: "active";
}
interface BenchPokemonDescriptor {
  cardId: string;
  location: "bench";
  index: number;
}
export type InPlayPokemonDescriptor = ActivePokemonDescriptor | BenchPokemonDescriptor;
