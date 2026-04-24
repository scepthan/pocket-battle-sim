import type { Game } from "../Game";
import type { InPlayPokemon } from "../InPlayPokemon";

/**
 * Generates a side effect that lets the player choose an attack on one of their opponent's
 * Pokémon and use it as their own Pokémon's attack.
 * @param activeOnly Whether the player is restricted to attacks on the opponent's active Pokémon.
 * @param energyRequired Whether the Pokémon copying the attack is required to meet the chosen
 * attack's energy cost in order to use it.
 */
export const chooseAttackToCopy =
  (activeOnly: boolean, energyRequired: boolean) => async (game: Game, self: InPlayPokemon) => {
    const prompt1 = "Choose a Pokémon to copy an attack from.";
    const chosenPokemon = activeOnly
      ? self.opponent.activeOrThrow()
      : await game.choosePokemon(self.player, self.opponent.InPlayPokemon, prompt1);
    if (!chosenPokemon) {
      game.GameLog.attackFailed(self.player);
      return;
    }
    const attacks = Object.fromEntries(chosenPokemon.attacks.map((a) => [a.name, a]));
    const prompt2 = `Choose an attack to copy from ${chosenPokemon.Name}.`;
    const chosenAttack = await game.choose(self.player, attacks, prompt2);
    if (!chosenAttack) {
      game.GameLog.attackFailed(self.player);
      return;
    }
    await game.copyAttack(chosenAttack, !!energyRequired);
  };
