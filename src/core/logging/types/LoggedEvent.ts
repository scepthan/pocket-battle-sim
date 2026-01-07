import type {
  Energy,
  PlayerStatus,
  PokemonStatus,
  PrimaryCondition,
  SecondaryCondition,
  SpecialCondition,
} from "../../gamelogic";
import type { InPlayPokemonDescriptor } from "./InPlayPokemonDescriptor";

type CoinFlipResult = "Heads" | "Tails";

export interface HpChangeEvent {
  initialHP: number;
  finalHP: number;
  maxHP: number;
}

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
  reason:
    | "notImplemented"
    | "partiallyImplemented"
    | "noBenchedPokemon"
    | "benchFull"
    | "noValidCards"
    | "noValidTargets";
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
interface PutIntoHandEvent {
  type: "putIntoHand";
  player: string;
  cardIds: string[];
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
interface AttachPokemonToolEvent {
  type: "attachPokemonTool";
  player: string;
  cardId: string;
  targetPokemon: InPlayPokemonDescriptor;
}
interface TriggerPokemonToolEvent {
  type: "triggerPokemonTool";
  player: string;
  cardId: string;
  targetPokemon: InPlayPokemonDescriptor;
}
interface RemovePokemonToolEvent {
  type: "removePokemonTool";
  player: string;
  cardId: string;
  targetPokemon: InPlayPokemonDescriptor;
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
interface ReturnToBottomOfDeckEvent {
  type: "returnToBottomOfDeck";
  player: string;
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

export type SwapActivePokemonReason = "retreat" | "selfEffect" | "opponentEffect";
interface SwapActivePokemonEvent {
  type: "swapActivePokemon";
  player: string;
  choosingPlayer?: string;
  reason: SwapActivePokemonReason;
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
interface ChangeNextEnergyEvent {
  type: "changeNextEnergy";
  player: string;
  nextEnergy: Energy;
}
export type AttachEnergySource = "turn" | "energyZone" | "discard" | "pokemon";
interface AttachEnergyEvent {
  type: "attachEnergy";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  energyTypes: Energy[];
  from: AttachEnergySource;
  fromPokemon?: InPlayPokemonDescriptor;
}
export type DiscardEnergySource =
  | "effect"
  | "retreat"
  | "knockOut"
  | "removedFromField"
  | "energyZone";
interface DiscardEnergyEvent {
  type: "discardEnergy";
  player: string;
  source: DiscardEnergySource;
  targetPokemon?: InPlayPokemonDescriptor;
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

interface PokemonDamagedEvent extends HpChangeEvent {
  type: "pokemonDamaged";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  fromAttack: boolean;
  damageDealt: number;
  weaknessBoost?: boolean;
}
interface PokemonHealedEvent extends HpChangeEvent {
  type: "pokemonHealed";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  healingDealt: number;
}
interface PokemonHpSetEvent extends HpChangeEvent {
  type: "pokemonHpSet";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
}
interface PokemonKnockedOutEvent {
  type: "pokemonKnockedOut";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  fromAttack: boolean;
}
interface SpecialConditionAppliedEvent {
  type: "specialConditionApplied";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  specialConditions: SpecialCondition[];
  currentConditionList: SpecialCondition[];
}
interface SpecialConditionEndedEvent {
  type: "specialConditionEnded";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  specialConditions: SpecialCondition[];
  currentConditionList: SpecialCondition[];
}
interface SpecialConditionDamageEvent extends HpChangeEvent {
  type: "specialConditionDamage";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  specialCondition: SecondaryCondition;
  damageDealt: number;
}
interface SpecialConditionEffectiveEvent {
  type: "specialConditionEffective";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  specialCondition: PrimaryCondition;
}
interface PokemonStatusAppliedEvent {
  type: "applyPokemonStatus";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  status: PokemonStatus;
}
interface PokemonStatusRemovedEvent {
  type: "removePokemonStatus";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
  status: PokemonStatus;
}
interface PlayerStatusAppliedEvent {
  type: "applyPlayerStatus";
  player: string;
  status: PlayerStatus;
}
interface PlayerStatusRemovedEvent {
  type: "removePlayerStatus";
  player: string;
  status: PlayerStatus;
}
interface AttackFailedEvent {
  type: "attackFailed";
  player: string;
}
interface DamagePreventedEvent {
  type: "damagePrevented";
  damageType: "Damage" | "Effect" | "SpecialCondition";
  player: string;
  targetPokemon: InPlayPokemonDescriptor;
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
  | PutIntoHandEvent
  | PlayToActiveEvent
  | PlayToBenchEvent
  | PlayTrainerEvent
  | AttachPokemonToolEvent
  | TriggerPokemonToolEvent
  | RemovePokemonToolEvent
  | DiscardCardsEvent
  | ReturnToHandEvent
  | ReturnToDeckEvent
  | ReturnToBottomOfDeckEvent
  | ShuffleDeckEvent
  | SwapActivePokemonEvent
  | SelectActivePokemonEvent
  | EvolvePokemonEvent
  | ViewCardsEvent
  | GenerateNextEnergyEvent
  | ChangeNextEnergyEvent
  | AttachEnergyEvent
  | DiscardEnergyEvent
  | TriggerAbilityEvent
  | UseAbilityEvent
  | UseAttackEvent
  | CopyAttackEvent
  | PokemonDamagedEvent
  | PokemonHealedEvent
  | PokemonHpSetEvent
  | PokemonKnockedOutEvent
  | SpecialConditionAppliedEvent
  | SpecialConditionEndedEvent
  | SpecialConditionDamageEvent
  | SpecialConditionEffectiveEvent
  | PokemonStatusAppliedEvent
  | PokemonStatusRemovedEvent
  | PlayerStatusAppliedEvent
  | PlayerStatusRemovedEvent
  | AttackFailedEvent
  | DamagePreventedEvent
  | CoinFlipEvent
  | CoinMultiFlipEvent
  | CoinFlipUntilTailsEvent;
