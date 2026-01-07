import type {
  Energy,
  InPlayPokemon,
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
  get previousTurn() {
    return this.turns[1];
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

  changeNextEnergy(player: Player) {
    this.addEntry({
      type: "changeNextEnergy",
      player: player.Name,
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
    fromPokemon: InPlayPokemon,
    toPokemon: InPlayPokemon,
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

  evolvePokemon(player: Player, pokemon: InPlayPokemon, card: PokemonCard) {
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

  discardFromDeck(player: Player, cards: PlayingCard[]) {
    this.addEntry({
      type: "discardCards",
      player: player.Name,
      source: "deck",
      cardIds: cards.map((card) => card.ID),
    });
  }

  returnInPlayPokemonToHand(player: Player, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "returnToHand",
      player: player.Name,
      source: "inPlay",
      cardIds: pokemon.InPlayCards.filter((card) => card.CardType !== "PokemonTool").map(
        (card) => card.ID
      ),
    });
  }

  returnInPlayPokemonToDeck(player: Player, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "returnToDeck",
      player: player.Name,
      source: "inPlay",
      cardIds: pokemon.InPlayCards.filter((card) => card.CardType !== "PokemonTool").map(
        (card) => card.ID
      ),
    });
  }

  returnToDeck(player: Player, cards: PlayingCard[], source: "hand" | "discard" | "inPlay") {
    this.addEntry({
      type: "returnToDeck",
      player: player.Name,
      source,
      cardIds: cards.map((card) => card.ID),
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
    targetPokemon: InPlayPokemon,
    energyTypes: Energy[],
    from: AttachEnergySource,
    fromPokemon?: InPlayPokemon
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
    targetPokemon?: InPlayPokemon
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

  specialConditionEffective(pokemon: InPlayPokemon) {
    this.addEntry({
      type: "specialConditionEffective",
      player: pokemon.player.Name,
      targetPokemon: pokemon.player.pokemonToDescriptor(pokemon),
      specialCondition: pokemon.PrimaryCondition!,
    });
  }

  specialConditionDamage(
    pokemon: InPlayPokemon,
    condition: SecondaryCondition,
    initialHP: number,
    damage: number
  ) {
    this.addEntry({
      type: "specialConditionDamage",
      player: pokemon.player.Name,
      specialCondition: condition,
      targetPokemon: pokemon.player.pokemonToDescriptor(pokemon),
      initialHP: initialHP,
      damageDealt: damage,
      finalHP: pokemon.CurrentHP,
      maxHP: pokemon.MaxHP,
    });
  }

  specialConditionEnded(pokemon: InPlayPokemon, conditions: SpecialCondition[]) {
    this.addEntry({
      type: "specialConditionEnded",
      player: pokemon.player.Name,
      targetPokemon: pokemon.player.pokemonToDescriptor(pokemon),
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

  useAbility(player: Player, pokemon: InPlayPokemon, ability: string) {
    this.addEntry({
      type: "useAbility",
      player: player.Name,
      abilityName: ability,
      abilityPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  triggerAbility(player: Player, pokemon: InPlayPokemon, ability: string) {
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

  attachPokemonTool(player: Player, card: PlayingCard, targetPokemon: InPlayPokemon) {
    this.addEntry({
      type: "attachPokemonTool",
      player: player.Name,
      cardId: card.ID,
      targetPokemon: player.pokemonToDescriptor(targetPokemon),
    });
  }

  triggerPokemonTool(player: Player, tool: PlayingCard, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "triggerPokemonTool",
      player: player.Name,
      cardId: tool.ID,
      targetPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  removePokemonTool(player: Player, card: PlayingCard, targetPokemon: InPlayPokemon) {
    this.addEntry({
      type: "removePokemonTool",
      player: player.Name,
      cardId: card.ID,
      targetPokemon: player.pokemonToDescriptor(targetPokemon),
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
    pokemon: InPlayPokemon,
    initialHP: number,
    damageDealt: number,
    weaknessBoost?: boolean
  ) {
    this.pokemonDamaged(player, pokemon, initialHP, damageDealt, true, weaknessBoost);
  }

  pokemonDamaged(
    player: Player,
    pokemon: InPlayPokemon,
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

  pokemonHealed(player: Player, pokemon: InPlayPokemon, initialHP: number, HP: number) {
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

  pokemonHpSet(player: Player, pokemon: InPlayPokemon, initialHP: number, HP: number) {
    this.addEntry({
      type: "pokemonHpSet",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      initialHP,
      finalHP: HP,
      maxHP: pokemon.MaxHP,
    });
  }

  pokemonKnockedOut(player: Player, pokemon: InPlayPokemon, fromAttack: boolean) {
    this.addEntry({
      type: "pokemonKnockedOut",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      fromAttack,
    });
  }

  applyPokemonStatus(player: Player, pokemon: InPlayPokemon, status: PokemonStatus) {
    this.addEntry({
      type: "applyPokemonStatus",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
      status,
    });
  }

  removePokemonStatus(pokemon: InPlayPokemon, status: PokemonStatus) {
    this.addEntry({
      type: "removePokemonStatus",
      player: pokemon.player.Name,
      targetPokemon: pokemon.player.pokemonToDescriptor(pokemon),
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

  removePlayerStatus(player: Player, status: PlayerStatus) {
    this.addEntry({
      type: "removePlayerStatus",
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

  damagePrevented(player: Player, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "damagePrevented",
      damageType: "Damage",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  effectPrevented(player: Player, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "damagePrevented",
      damageType: "Effect",
      player: player.Name,
      targetPokemon: player.pokemonToDescriptor(pokemon),
    });
  }

  specialConditionPrevented(player: Player, pokemon: InPlayPokemon) {
    this.addEntry({
      type: "damagePrevented",
      damageType: "SpecialCondition",
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
