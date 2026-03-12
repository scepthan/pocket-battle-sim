<template>
  <div v-if="game?.isGameOver">
    <p>Game over!</p>

    <div class="d-flex flex-wrap ga-2">
      <v-btn @click="emit('playAgain')"> Play Again </v-btn>
      <v-btn @click="emit('changeDecks')"> Change Decks </v-btn>
    </div>
  </div>

  <div v-else-if="stage === 'selectCard'">
    <SelectionMenu
      :selector="cardSelector"
      :button-text="(card) => card.Name"
      default-prompt="Select a card:"
    />
  </div>

  <div v-else-if="stage === 'selectEnergy'">
    <SelectionMenu
      :selector="energySelector"
      :button-text="(energy) => energy"
      default-prompt="Select energy:"
    />
  </div>

  <div v-else-if="stage === 'selectPokemon'">
    <SelectionMenu
      :selector="pokemonSelector"
      :button-text="(pokemon) => pokemon.Name"
      default-prompt="Select a Pokémon:"
    />
  </div>

  <div v-else-if="stage === 'selectAny'">
    <SelectionMenu
      :selector="baseSelector"
      :button-text="(option) => option"
      default-prompt="Select one:"
    />
  </div>

  <div v-else-if="stage === 'doTurn'">
    <p>What would you like to do?</p>

    <div class="d-flex flex-wrap ga-2">
      <v-btn :disabled="playableCards.length === 0" @click="actionSelector.select('playCard')">
        Play Card
      </v-btn>
      <v-btn
        :disabled="!game?.selfAvailableEnergy"
        @click="actionSelector.select('attachTurnEnergy')"
      >
        Attach Energy
      </v-btn>
      <v-btn :disabled="usableAbilities.length === 0" @click="actionSelector.select('useAbility')">
        Use Ability
      </v-btn>
      <v-btn
        :disabled="!game?.canRetreat(true)"
        :color="game?.canRetreat(true) && game.retreatCostModifier < 0 ? 'green' : 'default'"
        @click="actionSelector.select('retreat')"
      >
        Retreat
      </v-btn>
      <v-btn
        :disabled="usableAttacks.length === 0"
        :color="usableAttacks.length > 0 && actionsLeft ? 'red' : 'default'"
        @click="actionSelector.select('attack')"
      >
        Attack
        <span v-if="usableAttacks.length === 1">
          ({{ game?.getAttackDamageDisplay(usableAttacks[0]!) }})
        </span>
      </v-btn>
      <v-btn
        :color="actionsLeft || usableAttacks.length > 0 ? 'red' : 'default'"
        @click="actionSelector.select('endTurn')"
      >
        End Turn
      </v-btn>
    </div>
  </div>

  <div v-else-if="game?.currentTurnNumber === 0">
    <p>Waiting to start...</p>
  </div>

  <div v-else-if="game?.isSelfTurn">
    <p>Executing...</p>
  </div>

  <div v-else>
    <p>Waiting for opponent...</p>
  </div>
</template>

<script setup lang="ts">
import {
  CANCEL_OPTION,
  READY_OPTION,
  useSelectionHandler,
  type SelectionHandler,
} from "@/composables";
import {
  PlayerAgent,
  PlayerGameView,
  PlayerPokemonView,
  removeElement,
  type Energy,
  type PlayingCard,
  type PokemonCard,
} from "@/core";

const emit = defineEmits<{
  (e: "playAgain"): void;
  (e: "changeDecks"): void;
}>();

const agent = defineModel<PlayerAgent>("agent");
const game = ref<PlayerGameView>();

const playableCards = computed(
  () => game.value?.selfHand.filter((card) => game.value?.canPlayCard(card, true)) ?? [],
);
const usableAbilities = computed(
  () =>
    game.value?.selfInPlayPokemon.filter(
      (pokemon) => pokemon.Ability && game.value?.canUseAbility(pokemon, pokemon.Ability, true),
    ) ?? [],
);
const usableAttacks = computed(() =>
  game.value?.selfActive.isPokemon
    ? (game.value.selfActive.Attacks.filter((attack) => game.value?.canUseAttack(attack, true)) ??
      [])
    : [],
);

const actionsLeft = computed(
  () =>
    playableCards.value.some((x) => x.CardType === "Supporter" || x.CardType === "Pokemon") ||
    game.value?.selfAvailableEnergy ||
    usableAbilities.value.length > 0,
);

const stage = ref<string>("idle");

const pokemonSetup = defineModel<{ active?: PokemonCard; bench: PokemonCard[] }>("setup", {
  required: true,
});

const actionSelector = useSelectionHandler<string>();
const cardSelector = useSelectionHandler<PlayingCard>();
const energySelector = useSelectionHandler<Energy>();
const pokemonSelector = useSelectionHandler<PlayerPokemonView>();
const baseSelector = useSelectionHandler<string>();

const setupAgent = () => {
  if (!agent.value) return;
  game.value = undefined;

  agent.value.setupPokemon = async (gameView) => {
    while (true) {
      stage.value = "selectCard";
      cardSelector.prompt.value = "Select your Active Pokémon:";
      cardSelector.options.value = gameView.hand.filter(
        (card) => card.CardType === "Pokemon" && card.Stage === 0,
      );

      const active = (await cardSelector.selectionPromise()) as PokemonCard;
      pokemonSetup.value.active = active;
      removeElement(cardSelector.options.value, active);

      const bench: PokemonCard[] = [];
      cardSelector.prompt.value = "Select your Benched Pokémon:";
      cardSelector.allowReady.value = true;
      cardSelector.allowCancel.value = true;

      let cancelling = false;

      while (true) {
        const selectedPokemon = await cardSelector.selectionPromise();
        if (selectedPokemon === READY_OPTION) break;
        if (selectedPokemon === CANCEL_OPTION) {
          cancelling = true;
          break;
        }

        bench.push(selectedPokemon as PokemonCard);
        pokemonSetup.value.bench.push(selectedPokemon as PokemonCard);

        if (bench.length >= 3) cardSelector.options.value = [];
        else removeElement(cardSelector.options.value, selectedPokemon);
      }

      stage.value = "idle";
      cardSelector.reset();
      pokemonSetup.value.active = undefined;
      pokemonSetup.value.bench = [];

      if (!cancelling) return { active, bench };
    }
  };

  agent.value.doTurn = async (gameView) => {
    game.value = gameView;
    while (true) {
      if (!gameView.canPlay) {
        stage.value = "idle";
        return;
      }

      stage.value = "doTurn";

      const action = await actionSelector.selectionPromise();
      if (action === "endTurn") {
        stage.value = "idle";
        return;
      } else if (action === "attachTurnEnergy") {
        stage.value = "selectPokemon";
        pokemonSelector.prompt.value = "Select a Pokémon to attach energy to:";
        pokemonSelector.options.value = gameView.selfInPlayPokemon.filter((p) =>
          gameView.canAttachFromEnergyZone(p, true),
        );
        pokemonSelector.allowCancel.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();
        stage.value = "idle";
        pokemonSelector.reset();

        if (typeof selectedPokemon === "symbol") continue;
        await gameView.attachAvailableEnergy(selectedPokemon);
      } else if (action === "playCard") {
        stage.value = "selectCard";
        cardSelector.prompt.value = "Select a card to play:";
        cardSelector.options.value = playableCards.value.slice();
        cardSelector.allowCancel.value = true;

        const selectedCard = await cardSelector.selectionPromise();
        stage.value = "idle";
        cardSelector.reset();

        if (typeof selectedCard === "symbol") continue;

        switch (selectedCard.CardType) {
          case "Pokemon":
            if (selectedCard.Stage === 0) {
              const index = gameView.selfBench.findIndex((p) => !p.isPokemon);
              await gameView.playPokemonToBench(selectedCard, index);
            } else {
              const evolvablePokemon = gameView.selfInPlayPokemon.filter(
                (p) =>
                  p.isPokemon && p.EvolvesAs === selectedCard.EvolvesFrom && gameView.canEvolve(p),
              );
              if (evolvablePokemon.length === 0) {
                console.log("No valid Pokémon to evolve.");
                break;
              }
              let targetPokemon = evolvablePokemon[0]!;
              if (evolvablePokemon.length > 1) {
                stage.value = "selectPokemon";
                pokemonSelector.prompt.value = "Select a Pokémon to evolve:";
                pokemonSelector.options.value = evolvablePokemon;
                pokemonSelector.allowCancel.value = true;

                const selectedPokemon = await pokemonSelector.selectionPromise();

                stage.value = "idle";
                pokemonSelector.reset();

                if (typeof selectedPokemon === "symbol") break;
                targetPokemon = selectedPokemon;
              }
              await gameView.playPokemonToEvolve(selectedCard, targetPokemon);
            }
            break;

          case "Fossil":
            const slot = gameView.selfBench.find((p) => !p.isPokemon);
            if (slot) await gameView.playFossilCard(selectedCard, slot);
            break;

          case "Item":
          case "Supporter":
          case "PokemonTool":
            const playSelectedCard = async (target?: PlayerPokemonView) => {
              if (selectedCard.CardType === "Supporter") {
                await gameView.playSupporterCard(selectedCard, target);
              } else if (selectedCard.CardType === "Item") {
                await gameView.playItemCard(selectedCard, target);
              } else {
                if (!target || !target.isPokemon)
                  throw new Error("No target selected for PokemonTool card");
                await gameView.playPokemonToolCard(selectedCard, target);
              }
            };

            if (
              selectedCard.CardType === "PokemonTool" ||
              selectedCard.Effect.type === "Targeted"
            ) {
              stage.value = "selectPokemon";
              pokemonSelector.prompt.value = "Select a Pokémon to use it on:";
              pokemonSelector.options.value = gameView.validTargets(selectedCard);
              pokemonSelector.allowCancel.value = true;

              const selectedPokemon = await pokemonSelector.selectionPromise();
              stage.value = "idle";
              pokemonSelector.reset();

              if (typeof selectedPokemon === "symbol") break;
              await playSelectedCard(selectedPokemon);
            } else {
              await playSelectedCard();
            }
            break;
        }
      } else if (action === "useAbility") {
        stage.value = "selectPokemon";
        pokemonSelector.prompt.value = "Select a Pokémon to use its ability:";
        pokemonSelector.options.value = usableAbilities.value;
        pokemonSelector.allowCancel.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();
        stage.value = "idle";
        pokemonSelector.reset();

        if (typeof selectedPokemon === "symbol") continue;
        await gameView.useAbility(selectedPokemon, selectedPokemon.Ability!);
      } else if (action === "retreat") {
        stage.value = "selectPokemon";
        pokemonSelector.prompt.value = "Select a Pokémon to swap in:";
        pokemonSelector.options.value = gameView.selfBenched;
        pokemonSelector.allowCancel.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();
        stage.value = "idle";
        pokemonSelector.reset();

        if (typeof selectedPokemon === "symbol") continue;
        await gameView.retreatActivePokemon(selectedPokemon);
      } else if (action === "attack") {
        let attackName: string = "";

        if (usableAttacks.value.length === 1) {
          attackName = usableAttacks.value[0]!.name;
        } else {
          stage.value = "selectAny";
          baseSelector.prompt.value = "Select an attack:";
          baseSelector.options.value = usableAttacks.value.map((attack) => attack.name);
          baseSelector.allowCancel.value = true;

          const attackOption = await baseSelector.selectionPromise();
          if (typeof attackOption === "symbol") continue;

          attackName = attackOption;
          baseSelector.reset();
        }
        stage.value = "idle";

        if (attackName) {
          const attack = usableAttacks.value.find((a) => a.name === attackName);
          if (attack) {
            await gameView.useAttack(attack);
            return;
          }
        }
      }
    }
  };

  agent.value.chooseNewActivePokemon = async (gameView) => {
    stage.value = "selectPokemon";
    pokemonSelector.prompt.value = "Select a Pokémon to swap in:";
    pokemonSelector.options.value = gameView.selfBenched;

    const selectedPokemon = await pokemonSelector.selectionPromise();
    stage.value = "idle";
    pokemonSelector.reset();

    if (typeof selectedPokemon === "symbol") {
      throw new Error("No Pokémon selected to swap in.");
    }

    return selectedPokemon;
  };

  agent.value.choosePokemon = async (pokemon, prompt) => {
    stage.value = "selectPokemon";
    pokemonSelector.options.value = pokemon;
    pokemonSelector.prompt.value = prompt;

    const selectedPokemon = await pokemonSelector.selectionPromise();
    stage.value = "idle";
    pokemonSelector.reset();

    if (typeof selectedPokemon === "symbol") {
      throw new Error("No Pokémon selected.");
    }

    return selectedPokemon;
  };

  const chooseN = async <T,>(
    selector: SelectionHandler<T>,
    options: T[],
    n: number,
    prompt: string,
    isValid = (selected: T[]) => selected.length === n,
  ) => {
    selector.prompt.value = prompt;
    selector.options.value = options.slice();
    selector.allowCancel.value = true;

    const selected: T[] = [];
    while (true) {
      selector.allowReady.value = isValid(selected);
      const pick = await selector.selectionPromise();
      if (pick === CANCEL_OPTION) {
        selector.options.value = options.slice();
        selected.length = 0;
      } else if (pick === READY_OPTION) {
        break;
      } else if (selected.length < n) {
        selected.push(pick);
        removeElement(selector.options.value, pick);
      }
    }

    stage.value = "idle";
    selector.reset();

    return selected;
  };

  agent.value.chooseNPokemon = async (pokemon, n, prompt) => {
    stage.value = "selectPokemon";
    return await chooseN(pokemonSelector, pokemon, n, prompt);
  };

  agent.value.chooseCard = async (cards, prompt, filter = () => true) => {
    stage.value = "selectCard";
    cardSelector.options.value = cards.filter(filter);
    cardSelector.prompt.value = prompt;

    const selectedCard = await cardSelector.selectionPromise();
    stage.value = "idle";
    cardSelector.reset();

    if (typeof selectedCard === "symbol") {
      throw new Error("No card selected.");
    }

    return selectedCard;
  };

  agent.value.chooseNCards = async (cards, n, prompt) => {
    stage.value = "selectCard";
    return await chooseN(cardSelector, cards, n, prompt);
  };

  agent.value.chooseNEnergy = async (energy, n, prompt, isValid) => {
    stage.value = "selectEnergy";
    return await chooseN(energySelector, energy, n, prompt, isValid);
  };

  agent.value.choose = async (options, prompt) => {
    stage.value = "selectAny";
    baseSelector.options.value = options;
    baseSelector.prompt.value = prompt;

    const selectedOption = await baseSelector.selectionPromise();
    stage.value = "idle";
    baseSelector.reset();

    if (typeof selectedOption === "symbol") {
      throw new Error("No option selected.");
    }

    return selectedOption;
  };

  agent.value.distributeEnergy = async (validPokemon, energy) => {
    stage.value = "selectPokemon";
    pokemonSelector.options.value = validPokemon;
    pokemonSelector.allowCancel.value = true;

    const energyDistribution: Energy[][] = validPokemon.map(() => []);
    outerloop: while (true) {
      for (const energyToAttach of energy) {
        pokemonSelector.prompt.value = `Select a Pokémon to attach ${energyToAttach} Energy to:`;
        const pick = await pokemonSelector.selectionPromise();
        if (pick === CANCEL_OPTION) {
          energyDistribution.forEach((e) => (e.length = 0));
          continue outerloop;
        } else if (pick === READY_OPTION) {
          break;
        } else {
          const chosenIndex = validPokemon.findIndex(
            (p) => p.location === pick.location && p.benchIndex === pick.benchIndex,
          );
          energyDistribution[chosenIndex]!.push(energyToAttach);
        }
      }
      break;
    }

    stage.value = "idle";
    pokemonSelector.reset();

    return energyDistribution;
  };
};

onMounted(setupAgent);
watch(agent, setupAgent);
</script>
