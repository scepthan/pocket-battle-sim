export class EmptyCardSlot {
  location: "Active" | "Bench";
  index: number;

  isPokemon = false as const;

  constructor(location: "Active" | "Bench", index: number = -1) {
    this.location = location;
    this.index = index;
  }

  static Active() {
    return new EmptyCardSlot("Active");
  }
  static Bench(index: number) {
    return new EmptyCardSlot("Bench", index);
  }
}
