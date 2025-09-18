import type {
  Energy,
  InPlayPokemonCard,
  Player,
  PlayerStatus,
  PlayingCard,
  PokemonCard,
  PokemonStatus,
  SecondaryCondition,
  SpecialCondition,
  TrainerCard,
} from "../gamelogic";
import type {
  AttachEnergySource,
  DiscardEnergySource,
  LoggedEvent,
  SwapActivePokemonReason,
} from "./types";

const coinLog = (result: boolean) => (result ? "Heads" : "Tails");

export class GameLogger {
  turns: LoggedEvent[][] = [[]];
  get currentTurn() {
    return this.turns[0]!;
  }
  get entries() {
    return this.turns.slice().reverse().flat();
  }

  private addEntry(entry: LoggedEvent) {
    this.currentTurn.push(entry);
  }

  startGame(player1: Player, player2: Player) {
    this.addEntry({
      type: "startGame",
      firstPlayer: player1.Name,
      secondPlayer: player2.Name,
    });
  }

  nextTurn(turnNumber: number, attackingPlayer: Player, defendingPlayer: Player) {
    this.turns.unshift([]);
    this.addEntry({
      type: "nextTurn",
      turnNumber,
      attackingPlayer: attackingPlayer.Name,
      defendingPlayer: defendingPlayer.Name,
    });
  }

  pokemonCheckup() {
    this.addEntry({ type: "pokemonCheckup" });
  }

  generateNextEnergy(player: Player) {
    this.addEntry({
      type: "generateNextEnergy",
      player: player.Name,
      currentEnergy: player.AvailableEnergy ?? "none",
      nextEnergy: player.NextEnergy,
    });
  }

  playToActive(player: Player, card: PokemonCard) {
    this.addEntry({
      type: "playToActive",
      player: player.Name,
      cardId: card.ID,
    });
  }

  playToBench(player: Player, card: PokemonCard, benchIndex: number) {
    this.addEntry({
      type: "playToBench",
      player: player.Name,
      cardId: card.ID,
      benchIndex,
    });
  }

  selectActivePokemon(player: Player) {
    this.addEntry({
      type: "selectActivePokemon",
      player: player.Name,
      toPokemon: player.pokemonToDescriptor(player.activeOrThrow()),
    });
  }

  swapActivePokemon(
    player: Player,
    fromPokemon: InPlayPokemonCard,
    toPokemon: InPlayPokemonCard,
    reason: SwapActivePokemonReason,
    choosingPlayer?: string
  ) {
    this.addEntry({
      type: "swapActivePokemon",
      player: player.Name,
      choosingPlayer,
      fromPokemon: player.pokemonToDescriptor(fromPokemon),
      toPokemon: player.pokemonToDescriptor(toPokemon),
      reason,
    });
  }

  evolvePokemon(player: Player, pokemon: InPlayPokemonCard, card: PokemonCard) {
    this.addEntry({
      type: "evolvePokemon",
      player: player.Name,
      cardId: card.ID,
      fromPokemon: player.pokemonToDescriptor(pokemon),
      stage: card.Stage,
    });
  }

  drawToHand(player: Player, attempted: number, cards: PlayingCard[]) {
    const success = attempted === cards.length;
    this.addEntry({
      type: "drawToHand",
      player: player.Name,
      attempted,
      cardIds: cards.map((card) => card.ID),
      success,
      failureReason: success ? undefined : player.Deck.length === 0 ? "deckEmpty" : "handFull",
    });
  }

  putIntoHand(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "putIntoHand",
      player: player.Name,
      cardIds: cards.map((card) => card.ID),
    });
  }

  drawRandomFiltered(player: Player, card?: PlayingCard) {
    const success = card !== undefined;
    this.addEntry({
      type: "drawToHand",
      player: player.Name,
      attempted: 1,
      cardIds: card ? [card.ID] : [],
      success,
      failureReason: success ? undefined : "noValidCards",
    });
  }

  shuffleDeck(player: Player) {
    this.addEntry({
      type: "shuffleDeck",
      player: player.Name,
    });
  }

  returnHandToDeck(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "returnToDeck",
      player: player.Name,
      source: "hand",
      cardIds: cards.map((card) => card.ID),
    });
  }

  discardFromHand(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "discardCards",
      player: player.Name,
      source: "hand",
      cardIds: cards.map((card) => card.ID),
    });
  }

  discardFromPlay(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "discardCards",
      player: player.Name,
      source: "inPlay",
      cardIds: cards.map((card) => card.ID),
    });
  }

  returnInPlayPokemonToHand(player: Player, pokemon: InPlayPokemonCard) {
    this.addEntry({
      type: "returnToHand",
      player: player.Name,
      source: "inPlay",
      cardIds: pokemon.InPlayCards.map((card) => card.ID),
    });
  }

  returnInPlayPokemonToDeck(player: Player, pokemon: InPlayPokemonCard) {
    this.addEntry({
      type: "returnToDeck",
      player: player.Name,
      source: "inPlay",
      cardIds: pokemon.InPlayCards.map((card) => card.ID),
    });
  }

  returnToBottomOfDeck(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "returnToBottomOfDeck",
      player: player.Name,
      cardIds: cards.map((card) => card.ID),
    });
  }

  attachEnergy(
    player: Player,
    targetPokemon: InPlayPokemonCard,
    energyTypes: Energy[],
    from: AttachEnergySource,
    fromPokemon?: InPlayPokemonCard
  ) {
    this.addEntry({
      type: "attachEnergy",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(targetPokemon),
      energyTypes,
      from,
      fromPokemon: fromPokemon ? player.pokemonToDescriptor(fromPokemon) : undefined,
    });
  }

  discardEnergy(
    player: Player,
    energyTypes: Energy[],
    source: DiscardEnergySource,
    targetPokemon?: InPlayPokemonCard
  ) {
    this.addEntry({
      type: "discardEnergy",
      player: player.Name,
      source,
      targetPokemon: targetPokemon ? player.pokemonToDescriptor(targetPokemon) : undefined,
      energyTypes,
    });
  }

  specialConditionApplied(player: Player, condition: SpecialCondition) {
    this.addEntry({
      type: "specialConditionApplied",
      player: player.Name,
      specialConditions: [condition],
      targetPokemon: player.pokemonToDescriptor(player.activeOrThrow()),
      currentConditionList: player.activeOrThrow().CurrentConditions,
    });
  }

  specialConditionEffective(player: Player) {
    this.addEntry({
      type: "specialConditionEffective",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(player.activeOrThrow()),
      specialCondition: player.activeOrThrow().PrimaryCondition!,
    });
  }

  specialConditionDamage(
    player: Player,
    condition: SecondaryCondition,
    initialHP: number,
    damage: number
  ) {
    const pokemon = player.activeOrThrow();
    this.addEntry({
      type: "specialConditionDamage",
      player: player.Name,
      specialCondition: condition,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      initialHP: initialHP,
      damageDealt: damage,
      finalHP: pokemon.CurrentHP,
      maxHP: pokemon.MaxHP,
    });
  }

  specialConditionEnded(player: Player, conditions: SpecialCondition[]) {
    const pokemon = player.activeOrThrow();
    this.addEntry({
      type: "specialConditionEnded",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      specialConditions: conditions,
      currentConditionList: pokemon.CurrentConditions,
    });
  }

  coinFlip(player: Player, result: boolean) {
    this.addEntry({
      type: "coinFlip",
      player: player.Name,
      result: coinLog(result),
    });
  }

  coinMultiFlip(player: Player, results: boolean[]) {
    this.addEntry({
      type: "coinMultiFlip",
      player: player.Name,
      flips: results.length,
      results: results.map(coinLog),
    });
  }

  coinFlipUntilTails(player: Player, results: boolean[]) {
    this.addEntry({
      type: "coinFlipUntilTails",
      player: player.Name,
      results: results.map(coinLog),
    });
  }

  useAttack(player: Player, attackName: string) {
    this.addEntry({
      type: "useAttack",
      player: player.Name,
      attackName,
      attackingPokemon: player.pokemonToDescriptor(player.activeOrThrow()),
    });
  }

  useAbility(player: Player, pokemon: InPlayPokemonCard, ability: string) {
    this.addEntry({
      type: "useAbility",
      player: player.Name,
      abilityName: ability,
      abilityPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  triggerAbility(player: Player, pokemon: InPlayPokemonCard, ability: string) {
    this.addEntry({
      type: "triggerAbility",
      player: player.Name,
      abilityName: ability,
      abilityPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  playTrainer(player: Player, card: TrainerCard) {
    this.addEntry({
      type: "playTrainer",
      player: player.Name,
      cardId: card.ID,
      trainerType: card.CardType,
    });
  }

  copyAttack(player: Player, attackName: string) {
    this.addEntry({
      type: "copyAttack",
      player: player.Name,
      attackName,
      attackingPokemon: player.pokemonToDescriptor(player.activeOrThrow()),
    });
  }

  attackDamage(
    player: Player,
    pokemon: InPlayPokemonCard,
    initialHP: number,
    damageDealt: number,
    weaknessBoost?: boolean
  ) {
    this.pokemonDamaged(player, pokemon, initialHP, damageDealt, true, weaknessBoost);
  }

  pokemonDamaged(
    player: Player,
    pokemon: InPlayPokemonCard,
    initialHP: number,
    damageDealt: number,
    fromAttack: boolean,
    weaknessBoost?: boolean
  ) {
    this.addEntry({
      type: "pokemonDamaged",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      fromAttack,
      damageDealt,
      initialHP,
      finalHP: pokemon.CurrentHP,
      maxHP: pokemon.MaxHP,
      weaknessBoost,
    });
  }

  pokemonHealed(player: Player, pokemon: InPlayPokemonCard, initialHP: number, HP: number) {
    this.addEntry({
      type: "pokemonHealed",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      initialHP,
      healingDealt: HP,
      finalHP: pokemon.CurrentHP,
      maxHP: pokemon.MaxHP,
    });
  }

  pokemonKnockedOut(player: Player, pokemon: InPlayPokemonCard, fromAttack: boolean) {
    this.addEntry({
      type: "pokemonKnockedOut",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      fromAttack,
    });
  }

  applyPokemonStatus(player: Player, pokemon: InPlayPokemonCard, status: PokemonStatus) {
    this.addEntry({
      type: "applyPokemonStatus",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      status,
    });
  }

  applyPlayerStatus(player: Player, status: PlayerStatus) {
    this.addEntry({
      type: "applyPlayerStatus",
      player: player.Name,
      status,
    });
  }

  viewCards(player: Player, cardIds: string[]) {
    this.addEntry({
      type: "viewCards",
      player: player.Name,
      cardIds,
    });
  }

  scorePrizePoints(player: Player, points: number) {
    this.addEntry({
      type: "scorePrizePoints",
      player: player.Name,
      prizePointsScored: points,
      totalPrizePoints: player.GamePoints,
    });
  }

  damagePrevented(player: Player, pokemon: InPlayPokemonCard) {
    this.addEntry({
      type: "damagePrevented",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  attackFailed(player: Player) {
    this.addEntry({
      type: "attackFailed",
      player: player.Name,
    });
  }

  noValidTargets(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "noValidTargets",
    });
  }

  noBenchedPokemon(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "noBenchedPokemon",
    });
  }

  benchFull(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "benchFull",
    });
  }

  noValidCards(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "noValidCards",
    });
  }

  notImplemented(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "notImplemented",
    });
  }

  partiallyImplemented(player: Player) {
    this.addEntry({
      type: "actionFailed",
      player: player.Name,
      reason: "partiallyImplemented",
    });
  }

  turnError(player: Player, error: string) {
    this.addEntry({
      type: "turnError",
      player: player.Name,
      error,
    });
  }

  invalidGameState() {
    this.addEntry({
      type: "gameOver",
      draw: true,
      reason: "invalidGameState",
    });
  }

  maxTurnNumberReached() {
    this.addEntry({
      type: "gameOver",
      draw: true,
      reason: "maxTurnNumberReached",
    });
  }

  logWinner(winner: string, conditions: string[]) {
    this.addEntry({
      type: "gameOver",
      draw: false,
      winner,
      reason: conditions.includes("maxPrizePointsReached")
        ? "maxPrizePointsReached"
        : "noPokemonLeft",
    });
  }

  bothPlayersGameOver() {
    this.addEntry({
      type: "gameOver",
      draw: true,
      reason: "bothPlayersGameOver",
    });
  }
}
