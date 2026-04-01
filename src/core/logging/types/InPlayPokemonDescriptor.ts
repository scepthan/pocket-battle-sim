interface ActivePokemonDescriptor {
  id: number;
  cardId: string;
  location: "Active";
}
interface BenchPokemonDescriptor {
  id: number;
  cardId: string;
  location: "Bench";
  index: number;
}
export type InPlayPokemonDescriptor = ActivePokemonDescriptor | BenchPokemonDescriptor;
