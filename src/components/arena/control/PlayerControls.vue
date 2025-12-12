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
      :button-text="(card: PlayingCard) => card.Name"
      default-text="Select a card:"
    />
  </div>

  <div v-else-if="stage === 'selectPokemon'">
    <SelectionMenu
      :selector="pokemonSelector"
      :button-text="(pokemon: PlayerPokemonView) => pokemon.Name"
      default-text="Select a Pokémon:"
    />
  </div>

  <div v-else-if="stage === 'selectAny'">
    <SelectionMenu
      :selector="baseSelector"
      :button-text="(option: string) => option"
      default-text="Select one:"
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
import { useSelectionHandler } from "@/composables";
import {
  PlayerAgent,
  PlayerGameView,
  PlayerPokemonView,
  removeElement,
  type CardSlotView,
  type GameInitState,
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
  () => game.value?.selfHand.filter((card) => game.value?.canPlayCard(card, true)) ?? []
);
const usableAbilities = computed(
  () =>
    game.value?.selfInPlayPokemon.filter(
      (pokemon) => pokemon.Ability && game.value?.canUseAbility(pokemon, pokemon.Ability, true)
    ) ?? []
);
const usableAttacks = computed(() =>
  game.value?.selfActive.isPokemon
    ? game.value.selfActive.Attacks.filter((attack) => game.value?.canUseAttack(attack, true)) ?? []
    : []
);

const actionsLeft = computed(
  () =>
    playableCards.value.some((x) => x.CardType === "Supporter" || x.CardType === "Pokemon") ||
    game.value?.selfAvailableEnergy ||
    usableAbilities.value.length > 0
);

const stage = ref<string>("idle");

const pokemonSetup = defineModel<{ active?: PokemonCard; bench: PokemonCard[] }>("setup", {
  required: true,
});

const actionSelector = useSelectionHandler<string>();
const cardSelector = useSelectionHandler<PlayingCard>();
const pokemonSelector = useSelectionHandler<PlayerPokemonView>();
const baseSelector = useSelectionHandler<string>();

const setupAgent = () => {
  if (!agent.value) return;
  game.value = undefined;

  agent.value.setupPokemon = async (gameView: GameInitState) => {
    while (true) {
      stage.value = "selectCard";
      cardSelector.text.value = "Select your Active Pokémon:";
      cardSelector.options.value = gameView.hand.filter(
        (card) => card.CardType === "Pokemon" && card.Stage === 0
      );

      const active = (await cardSelector.selectionPromise()) as PokemonCard;
      pokemonSetup.value.active = active;
      removeElement(cardSelector.options.value, active);

      const bench: PokemonCard[] = [];
      cardSelector.text.value = "Select your Benched Pokémon:";
      cardSelector.addReadyButton.value = true;
      cardSelector.addCancelButton.value = true;

      let cancelling = false;

      while (true) {
        const selectedPokemon = await cardSelector.selectionPromise();
        if (selectedPokemon === null) break;
        if (selectedPokemon === "cancel") {
          cancelling = true;
          break;
        }

        bench.push(selectedPokemon as PokemonCard);
        pokemonSetup.value.bench.push(selectedPokemon as PokemonCard);

        if (bench.length >= 3) cardSelector.options.value = [];
        else removeElement(cardSelector.options.value, selectedPokemon);
      }

      stage.value = "idle";
      cardSelector.options.value = [];
      cardSelector.text.value = undefined;
      cardSelector.addReadyButton.value = false;
      cardSelector.addCancelButton.value = false;
      pokemonSetup.value.active = undefined;
      pokemonSetup.value.bench = [];

      if (!cancelling) return { active, bench };
    }
  };

  agent.value.doTurn = async (gameView: PlayerGameView) => {
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
        pokemonSelector.text.value = "Select a Pokémon to attach energy to:";
        pokemonSelector.options.value = gameView.selfInPlayPokemon;
        pokemonSelector.addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        pokemonSelector.addCancelButton.value = false;

        if (selectedPokemon === "cancel") {
          continue;
        } else if (selectedPokemon?.isPokemon) {
          await gameView.attachAvailableEnergy(selectedPokemon);
        }
      } else if (action === "playCard") {
        stage.value = "selectCard";
        cardSelector.text.value = "Select a card to play:";
        cardSelector.options.value = playableCards.value.slice();
        cardSelector.addCancelButton.value = true;

        const selectedCard = await cardSelector.selectionPromise();

        stage.value = "idle";
        cardSelector.text.value = undefined;
        cardSelector.options.value = [];
        cardSelector.addCancelButton.value = false;

        if (selectedCard === "cancel" || selectedCard === null) {
          continue;
        }

        switch (selectedCard.CardType) {
          case "Pokemon":
            if (selectedCard.Stage === 0) {
              const index = gameView.selfBench.findIndex((p) => !p.isPokemon);
              await gameView.playPokemonToBench(selectedCard, index);
            } else {
              const evolvablePokemon = gameView.selfInPlayPokemon.filter(
                (p) => p.isPokemon && p.Name === selectedCard.EvolvesFrom && gameView.canEvolve(p)
              );
              if (evolvablePokemon.length === 0) {
                console.log("No valid Pokémon to evolve.");
                break;
              }
              let targetPokemon = evolvablePokemon[0]!;
              if (evolvablePokemon.length > 1) {
                stage.value = "selectPokemon";
                pokemonSelector.text.value = "Select a Pokémon to evolve:";
                pokemonSelector.options.value = evolvablePokemon;
                pokemonSelector.addCancelButton.value = true;

                const selectedPokemon = await pokemonSelector.selectionPromise();

                stage.value = "idle";
                pokemonSelector.text.value = undefined;
                pokemonSelector.options.value = [];
                pokemonSelector.addCancelButton.value = false;

                if (selectedPokemon === "cancel") {
                  break;
                } else if (selectedPokemon?.isPokemon) {
                  targetPokemon = selectedPokemon;
                }
              }
              await gameView.playPokemonToEvolve(selectedCard, targetPokemon);
            }
            break;

          case "Fossil":
            const slot = gameView.selfBench.find((p) => !p.isPokemon);
            await gameView.playItemCard(selectedCard, slot);
            break;

          case "Item":
          case "Supporter":
          case "PokemonTool":
            const playSelectedCard = async (target?: CardSlotView) => {
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
              pokemonSelector.text.value = "Select a Pokémon to use it on:";
              pokemonSelector.options.value = gameView.validTargets(
                selectedCard
              ) as PlayerPokemonView[];
              pokemonSelector.addCancelButton.value = true;

              const selectedPokemon = await pokemonSelector.selectionPromise();

              stage.value = "idle";
              pokemonSelector.text.value = undefined;
              pokemonSelector.options.value = [];
              pokemonSelector.addCancelButton.value = false;

              if (selectedPokemon === "cancel") {
                break;
              } else if (selectedPokemon?.isPokemon) {
                await playSelectedCard(selectedPokemon);
              }
            } else {
              await playSelectedCard();
            }
            break;
        }
      } else if (action === "useAbility") {
        stage.value = "selectPokemon";
        pokemonSelector.text.value = "Select a Pokémon to use its ability:";
        pokemonSelector.options.value = usableAbilities.value;
        pokemonSelector.addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        pokemonSelector.addCancelButton.value = false;

        if (selectedPokemon === "cancel") {
          continue;
        } else if (selectedPokemon?.isPokemon) {
          await gameView.useAbility(selectedPokemon, selectedPokemon.Ability!);
        }
      } else if (action === "retreat") {
        stage.value = "selectPokemon";
        pokemonSelector.text.value = "Select a Pokémon to swap in:";
        pokemonSelector.options.value = gameView.selfBenched;
        pokemonSelector.addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        pokemonSelector.addCancelButton.value = false;

        if (selectedPokemon === "cancel") {
          continue;
        } else if (selectedPokemon?.isPokemon) {
          await gameView.retreatActivePokemon(selectedPokemon);
        }
      } else if (action === "attack") {
        let attackName: string | null = null;

        if (usableAttacks.value.length === 1) {
          attackName = usableAttacks.value[0]!.name;
        } else {
          stage.value = "selectAny";
          baseSelector.text.value = "Select an attack:";
          baseSelector.options.value = usableAttacks.value.map((attack) => attack.name);
          baseSelector.addCancelButton.value = true;

          attackName = await baseSelector.selectionPromise();

          baseSelector.text.value = undefined;
          baseSelector.options.value = [];
          baseSelector.addCancelButton.value = false;
        }
        stage.value = "idle";

        if (attackName === "cancel") {
          continue;
        } else if (attackName) {
          const attack = usableAttacks.value.find((a) => a.name === attackName);
          if (attack) {
            await gameView.useAttack(attack);
            return;
          }
        }
      } else {
        console.log(`Player selected action: ${action}`);
      }
    }
  };

  agent.value.swapActivePokemon = async (gameView: PlayerGameView) => {
    stage.value = "selectPokemon";
    pokemonSelector.text.value = "Select a Pokémon to swap in:";
    pokemonSelector.options.value = gameView.selfBenched;

    const selectedPokemon = await pokemonSelector.selectionPromise();

    stage.value = "idle";
    pokemonSelector.text.value = undefined;
    pokemonSelector.options.value = [];

    if (selectedPokemon === "cancel" || !selectedPokemon?.isPokemon) {
      throw new Error("No Pokémon selected to swap in.");
    }

    return selectedPokemon;
  };

  agent.value.choosePokemon = async (pokemon: PlayerPokemonView[]) => {
    stage.value = "selectPokemon";
    pokemonSelector.options.value = pokemon;

    const selectedPokemon = await pokemonSelector.selectionPromise();

    stage.value = "idle";
    pokemonSelector.options.value = [];

    if (selectedPokemon === "cancel" || !selectedPokemon?.isPokemon) {
      throw new Error("No Pokémon selected.");
    }

    return selectedPokemon;
  };

  agent.value.chooseNPokemon = async (pokemon: PlayerPokemonView[], n: number) => {
    stage.value = "selectPokemon";
    pokemonSelector.text.value = `Select ${n} Pokémon:`;
    pokemonSelector.options.value = pokemon.slice();
    pokemonSelector.addReadyButton.value = true;
    pokemonSelector.addCancelButton.value = true;

    const selectedPokemon: PlayerPokemonView[] = [];
    while (true) {
      const pick = await pokemonSelector.selectionPromise();
      if (pick === "cancel") {
        pokemonSelector.options.value = pokemon.slice();
        selectedPokemon.length = 0;
      } else if (pick === null) {
        break;
      } else if (selectedPokemon.length < n) {
        selectedPokemon.push(pick);
        removeElement(pokemonSelector.options.value, pick);
      }
    }

    stage.value = "idle";
    pokemonSelector.text.value = undefined;
    pokemonSelector.options.value = [];
    pokemonSelector.addReadyButton.value = false;
    pokemonSelector.addCancelButton.value = false;

    return selectedPokemon;
  };

  agent.value.chooseCard = async (cards: PlayingCard[]) => {
    stage.value = "selectCard";
    cardSelector.options.value = cards;

    const selectedCard = await cardSelector.selectionPromise();

    stage.value = "idle";
    cardSelector.options.value = [];

    if (selectedCard === "cancel" || !selectedCard) {
      throw new Error("No card selected.");
    }

    return selectedCard;
  };

  agent.value.chooseNCards = async (cards: PlayingCard[], n: number) => {
    stage.value = "selectCard";
    cardSelector.text.value = `Select ${n} cards:`;
    cardSelector.options.value = cards.slice();
    cardSelector.addReadyButton.value = true;
    cardSelector.addCancelButton.value = true;

    const selectedCards: PlayingCard[] = [];
    while (true) {
      const pick = await cardSelector.selectionPromise();
      if (pick === "cancel") {
        cardSelector.options.value = cards.slice();
        selectedCards.length = 0;
      } else if (pick === null) {
        break;
      } else if (selectedCards.length < n) {
        selectedCards.push(pick);
        removeElement(cardSelector.options.value, pick);
      }
    }

    stage.value = "idle";
    cardSelector.text.value = undefined;
    cardSelector.options.value = [];
    cardSelector.addReadyButton.value = false;
    cardSelector.addCancelButton.value = false;

    return selectedCards;
  };

  agent.value.choose = async (options: string[]) => {
    stage.value = "selectAny";
    baseSelector.options.value = options;

    const selectedOption = await baseSelector.selectionPromise();

    stage.value = "idle";
    baseSelector.options.value = [];

    if (selectedOption === "cancel" || !selectedOption) {
      throw new Error("No option selected.");
    }

    return selectedOption;
  };
};

onMounted(setupAgent);
watch(agent, setupAgent);
</script>
