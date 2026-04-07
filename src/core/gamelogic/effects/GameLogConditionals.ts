import type { InPlayPokemon } from "../InPlayPokemon";
import type { Player } from "../Player";

export const usedSpecificAttackLastTurn =
  (attackName: string) => (player: Player, self: InPlayPokemon) =>
    player.logger.turns[2]?.some(
      (e) => e.type === "useAttack" && e.attackName === attackName && e.player === self.player.Name,
    ) ?? false;

export const selfDamagedByAttackLastTurn = (player: Player, self: InPlayPokemon) =>
  player.logger.previousTurn?.some(
    (e) =>
      e.type === "pokemonDamaged" &&
      e.fromAttack &&
      e.targetPokemon.id === self.id &&
      e.targetPokemon.location === "Active",
  ) ?? false;

export const selfMovedToActiveThisTurn = (player: Player) => {
  // If any switching has happened this turn, then this condition is necessarily met
  const switchingEvents = player.logger.currentTurn.filter(
    (event) => event.type === "selectActivePokemon" || event.type === "swapActivePokemon",
  );
  return switchingEvents.some((event) => event.player === player.Name);
};

export const opposingPokemonKnockedOutByCurrentAttack = (player: Player) => {
  const damageEvents = player.logger.currentTurn.filter((event) => event.type === "pokemonDamaged");
  const activeAttackEvent = damageEvents.find(
    (event) =>
      event.player === player.opponent.Name &&
      event.targetPokemon.location === "Active" &&
      event.fromAttack,
  );
  if (!activeAttackEvent) return false;
  return activeAttackEvent.finalHP === 0;
};

export const ownPokemonKnockedOutByAttackLastTurn = (player: Player) =>
  player.logger.previousTurn?.some(
    (e) => e.type === "pokemonKnockedOut" && e.fromAttack && e.player === player.Name,
  ) ?? false;
