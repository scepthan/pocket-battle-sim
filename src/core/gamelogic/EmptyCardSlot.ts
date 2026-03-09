export class EmptyCardSlot {
  location: "Active" | "Bench";
  benchIndex: number;

  isPokemon = false as const;

  constructor(location: "Active" | "Bench", benchIndex: number = -1) {
    this.location = location;
    this.benchIndex = benchIndex;
  }

  static Active() {
    return new EmptyCardSlot("Active");
  }
  static Bench(index: number) {
    return new EmptyCardSlot("Bench", index);
  }
}
