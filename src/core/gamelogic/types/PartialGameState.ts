import type { LoggedEvent } from "@/core/logging";
import type { Energy } from "./Energy";
import type { PlayerStatus } from "./playerstatus";
import type { PokemonStatus } from "./pokemonstatus";
import type { SpecialCondition } from "./SpecialCondition";

export interface PartialGameState {
  gameLog?: LoggedEvent[][];
  turnNumber?: number;
  hasRetreated?: boolean;
  hasPlayedSupporter?: boolean;
  player1: PartialGameStatePlayer;
  player2: PartialGameStatePlayer;
  attackingPlayer?: 1 | 2;
}

interface PartialGameStatePlayer {
  deck: string[];
  hand: string[];
  discard?: string[];
  gamePoints?: number;

  energyTypes?: Energy[];
  availableEnergy?: Energy;
  nextEnergy?: Energy;
  discardedEnergy?: Energy[];

  activePokemon: PartialGameStatePokemon;
  bench?: (PartialGameStatePokemon | undefined)[];

  playerStatuses: PlayerStatus;
}

interface PartialGameStatePokemon {
  cardIds: string[];
  currentHp?: number;
  attachedEnergy?: Energy[];
  attachedToolCards?: string[];
  specialConditions?: SpecialCondition[];
  pokemonStatuses?: PokemonStatus[];
  hasUsedAbility?: boolean;
}
