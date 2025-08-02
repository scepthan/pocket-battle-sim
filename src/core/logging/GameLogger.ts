import type { PrimaryCondition, SecondaryCondition, SpecialCondition } from "../gamelogic";
import type { Energy } from "../types";

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
type CoinFlipResult = "Heads" | "Tails";

// General game format events
interface StartGameEvent {
  type: "startGame";
  firstPlayer: string;
  secondPlayer: string;
}
interface NextTurnEvent {
  type: "nextTurn";
  turnNumber: number;
  attackingPlayer: string;
  defendingPlayer: string;
}
interface PokemonCheckupEvent {
  type: "pokemonCheckup";
}
interface ScorePrizePointsEvent {
  type: "scorePrizePoints";
  player: string;
  prizePointsScored: number;
  totalPrizePoints: number;
}
interface GameOverEvent {
  type: "gameOver";
  draw: boolean;
  winner?: string;
  reason:
    | "maxTurnNumberReached"
    | "maxPrizePointsReached"
    | "noPokemonLeft"
    | "bothPlayersGameOver"
    | "concession"
    | "invalidGameState";
}
interface ActionFailedEvent {
  type: "actionFailed";
  player: string;
  reason: "notImplemented" | "partiallyImplemented" | "noBenchedPokemon" | "noValidTargets";
}
interface TurnErrorEvent {
  type: "turnError";
  player: string;
  error: string;
}

// Card movement events
interface DrawToHandEvent {
  type: "drawToHand";
  player: string;
  attempted: number;
  cardIds: string[];
  success: boolean;
  failureReason?: "handFull" | "deckEmpty" | "noValidCards";
}
interface PlayToActiveEvent {
  type: "playToActive";
  player: string;
  cardId: string;
}
interface PlayToBenchEvent {
  type: "playToBench";
  player: string;
  cardId: string;
  benchIndex: number;
}
interface PlayTrainerEvent {
  type: "playTrainer";
  player: string;
  cardId: string;
  trainerType: string;
  targetPokemon?: InPlayPokemonDescriptor;
}
interface DiscardCardsEvent {
  type: "discardCards";
  player: string;
  source: "hand" | "deck" | "inPlay";
  cardIds: string[];
}
interface ReturnToHandEvent {
  type: "returnToHand";
  player: string;
  source: "inPlay" | "discard";
  cardIds: string[];
}
interface ReturnToDeckEvent {
  type: "returnToDeck";
  player: string;
  source: "hand" | "inPlay" | "discard";
  cardIds: string[];
}
interface ShuffleDeckEvent {
  type: "shuffleDeck";
  player: string;
}
interface ViewCardsEvent {
  type: "viewCards";
  player: string;
  cardIds: string[];
}

interface SwapActivePokemonEvent {
  type: "swapActivePokemon";
  player: string;
  choosingPlayer?: string;
  reason: "retreat" | "selfEffect" | "opponentEffect";
  fromPokemon: InPlayPokemonDescriptor;
  toPokemon: InPlayPokemonDescriptor;
}
interface SelectActivePokemonEvent {
  type: "selectActivePokemon";
  player: string;
  toPokemon: InPlayPokemonDescriptor;
}
interface EvolvePokemonEvent {
  type: "evolvePokemon";
  player: string;
  cardId: string;
  fromPokemon: InPlayPokemonDescriptor;
  stage: number;
}

interface GenerateNextEnergyEvent {
  type: "generateNextEnergy";
  player: string;
  currentEnergy: Energy | "none";
  nextEnergy: Energy;
}
interface AttachEnergyEvent {
  type: "attachEnergy";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  energyTypes: Energy[];
  from: "player" | "energyZone" | "discard" | "pokemon";
  fromPokemon?: InPlayPokemonDescriptor;
}
interface DiscardEnergyEvent {
  type: "discardEnergy";
  player: string;
  source: "effect" | "retreat" | "knockOut" | "removedFromField" | "energyZone";
  energyTypes: Energy[];
}

interface TriggerAbilityEvent {
  type: "triggerAbility";
  player: string;
  abilityPokemon: InPlayPokemonDescriptor;
  abilityName: string;
}
interface UseAbilityEvent {
  type: "useAbility";
  player: string;
  abilityPokemon: InPlayPokemonDescriptor;
  abilityName: string;
  targetPokemon?: InPlayPokemonDescriptor; // Optional, if the ability targets a specific pokemon
}
interface UseAttackEvent {
  type: "useAttack";
  player: string;
  attackingPokemon: InPlayPokemonDescriptor;
  selectedDefendingPokemon?: InPlayPokemonDescriptor[]; // For attacks where the attacker can select one or more targets
  attackName: string;
}
interface CopyAttackEvent {
  type: "copyAttack";
  player: string;
  attackingPokemon: InPlayPokemonDescriptor;
  selectedDefendingPokemon?: InPlayPokemonDescriptor[]; // For attacks where the attacker can select one or more targets
  attackName: string;
}

interface PokemonDamagedEvent {
  type: "pokemonDamaged";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  fromAttack: boolean;
  initialHP: number;
  damageDealt: number;
  weaknessBoost?: boolean;
  finalHP: number;
  maxHP: number;
}
interface PokemonKnockedOutEvent {
  type: "pokemonKnockedOut";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
}
interface PokemonHealedEvent {
  type: "pokemonHealed";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  initialHP: number;
  healingDealt: number;
  finalHP: number;
  maxHP: number;
}
interface PokemonStatusAppliedEvent {
  type: "pokemonStatusApplied";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  statusConditions: SpecialCondition[];
  currentStatusList: SpecialCondition[];
}
interface PokemonStatusEndedEvent {
  type: "pokemonStatusEnded";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  statusConditions: SpecialCondition[];
  currentStatusList: SpecialCondition[];
}
interface PokemonStatusDamageEvent {
  type: "pokemonStatusDamage";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  statusCondition: SecondaryCondition;
  initialHP: number;
  damageDealt: number;
  finalHP: number;
  maxHP: number;
}
interface PokemonStatusEffectiveEvent {
  type: "pokemonStatusEffective";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  statusCondition: PrimaryCondition;
}
interface AttackFailedEvent {
  type: "attackFailed";
  player: string;
}

interface ApplyModifierEvent {
  type: "applyModifier";
  attribute: "retreatCost" | "activeDamage" | "damageReduction";
  player: string;
  newModifier: number;
  totalModifier: number;
}

interface CoinFlipEvent {
  type: "coinFlip";
  player: string;
  result: CoinFlipResult;
}
interface CoinMultiFlipEvent {
  type: "coinMultiFlip";
  player: string;
  flips: number;
  results: CoinFlipResult[];
}
interface CoinFlipUntilTailsEvent {
  type: "coinFlipUntilTails";
  player: string;
  results: CoinFlipResult[];
}

export type LoggedEvent =
  | StartGameEvent
  | NextTurnEvent
  | PokemonCheckupEvent
  | ScorePrizePointsEvent
  | GameOverEvent
  | ActionFailedEvent
  | TurnErrorEvent
  | DrawToHandEvent
  | PlayToActiveEvent
  | PlayToBenchEvent
  | PlayTrainerEvent
  | DiscardCardsEvent
  | ReturnToHandEvent
  | ReturnToDeckEvent
  | ShuffleDeckEvent
  | SwapActivePokemonEvent
  | SelectActivePokemonEvent
  | EvolvePokemonEvent
  | ViewCardsEvent
  | GenerateNextEnergyEvent
  | AttachEnergyEvent
  | DiscardEnergyEvent
  | TriggerAbilityEvent
  | UseAbilityEvent
  | UseAttackEvent
  | CopyAttackEvent
  | PokemonDamagedEvent
  | PokemonKnockedOutEvent
  | PokemonHealedEvent
  | PokemonStatusAppliedEvent
  | PokemonStatusEndedEvent
  | PokemonStatusDamageEvent
  | PokemonStatusEffectiveEvent
  | AttackFailedEvent
  | ApplyModifierEvent
  | CoinFlipEvent
  | CoinMultiFlipEvent
  | CoinFlipUntilTailsEvent;

export class GameLogger {
  entries: LoggedEvent[] = [];

  addEntry(entry: LoggedEvent) {
    this.entries.push(entry);
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
}
