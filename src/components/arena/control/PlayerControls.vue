<template>
  <div v-if="stage === 'selectCard'">
    <p>{{ cardSelector.text ?? "Select a card:" }}</p>
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        v-for="(card, i) in cardSelector.options.value"
        :key="i"
        @click="cardSelector.select(card)"
      >
        {{ card.Name }}
      </v-btn>
      <v-btn v-if="addReadyButton" color="green" @click="cardSelector.select(null)"> Ready </v-btn>
      <v-btn v-if="addCancelButton" color="red" @click="cardSelector.select('cancel')">
        Cancel
      </v-btn>
    </div>
  </div>

  <div v-else-if="stage === 'selectPokemon'">
    <p>{{ pokemonSelector.text ?? "Select a Pokémon:" }}</p>
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        v-for="(pokemon, i) in pokemonSelector.options.value as PlayerPokemonView[]"
        :key="i"
        @click="pokemonSelector.select(pokemon)"
      >
        {{ pokemon.Name }}
      </v-btn>
      <v-btn v-if="addCancelButton" color="red" @click="pokemonSelector.select('cancel')">
        Cancel
      </v-btn>
    </div>
  </div>

  <div v-else-if="stage === 'selectAny'">
    <p>{{ baseSelector.text ?? "Select one:" }}</p>
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        v-for="(option, i) in baseSelector.options.value"
        :key="i"
        @click="baseSelector.select(option)"
      >
        {{ option }}
      </v-btn>
      <v-btn v-if="addCancelButton" color="red" @click="baseSelector.select('cancel')">
        Cancel
      </v-btn>
    </div>
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
      <v-btn :disabled="!game?.canRetreat(true)" @click="actionSelector.select('retreat')">
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

const addReadyButton = ref<boolean>(false);
const addCancelButton = ref<boolean>(false);

const setupAgent = () => {
  if (!agent.value) return;

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
      addReadyButton.value = true;
      addCancelButton.value = true;

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
      addReadyButton.value = false;
      addCancelButton.value = false;
      pokemonSetup.value.active = undefined;
      pokemonSetup.value.bench = [];

      if (!cancelling) return { active, bench };
    }
  };

  agent.value.doTurn = async (gameView: PlayerGameView) => {
    game.value = gameView;
    while (true) {
      stage.value = "doTurn";

      const action = await actionSelector.selectionPromise();
      if (action === "endTurn") {
        stage.value = "idle";
        return;
      } else if (action === "attachTurnEnergy") {
        stage.value = "selectPokemon";
        pokemonSelector.text.value = "Select a Pokémon to attach energy to:";
        pokemonSelector.options.value = gameView.selfInPlayPokemon;
        addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        addCancelButton.value = false;

        if (selectedPokemon === "cancel") {
          continue;
        } else if (selectedPokemon?.isPokemon) {
          await gameView.attachAvailableEnergy(selectedPokemon);
        }
      } else if (action === "playCard") {
        stage.value = "selectCard";
        cardSelector.text.value = "Select a card to play:";
        cardSelector.options.value = playableCards.value.slice();
        addCancelButton.value = true;

        const selectedCard = await cardSelector.selectionPromise();

        stage.value = "idle";
        cardSelector.text.value = undefined;
        cardSelector.options.value = [];
        addCancelButton.value = false;

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
                (p) => p.isPokemon && p.Name === selectedCard.EvolvesFrom
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
                addCancelButton.value = true;

                const selectedPokemon = await pokemonSelector.selectionPromise();

                stage.value = "idle";
                pokemonSelector.text.value = undefined;
                pokemonSelector.options.value = [];
                addCancelButton.value = false;

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
              addCancelButton.value = true;

              const selectedPokemon = await pokemonSelector.selectionPromise();

              stage.value = "idle";
              pokemonSelector.text.value = undefined;
              pokemonSelector.options.value = [];
              addCancelButton.value = false;

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
        addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        addCancelButton.value = false;

        if (selectedPokemon === "cancel") {
          continue;
        } else if (selectedPokemon?.isPokemon) {
          await gameView.useAbility(selectedPokemon, selectedPokemon.Ability!);
        }
      } else if (action === "retreat") {
        stage.value = "selectPokemon";
        pokemonSelector.text.value = "Select a Pokémon to swap in:";
        pokemonSelector.options.value = gameView.selfBenched;
        addCancelButton.value = true;

        const selectedPokemon = await pokemonSelector.selectionPromise();

        stage.value = "idle";
        pokemonSelector.text.value = undefined;
        pokemonSelector.options.value = [];
        addCancelButton.value = false;

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
          addCancelButton.value = true;

          attackName = await baseSelector.selectionPromise();

          baseSelector.text.value = undefined;
          baseSelector.options.value = [];
          addCancelButton.value = false;
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

      if (!gameView.isSelfTurn) {
        stage.value = "idle";
        return;
      }
    }
  };
};

onMounted(setupAgent);
watch(agent, setupAgent);
</script>
