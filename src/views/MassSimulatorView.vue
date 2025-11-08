<template>
  <v-container>
    <v-row v-for="(record, deck) in overallRecords" :key="deck">
      <v-col cols="3">{{ deck }}</v-col>
      <v-col cols="2">{{ record.wins }}</v-col>
      <v-col cols="2">{{ record.losses }}</v-col>
      <v-col cols="2">{{ record.ties }}</v-col>
      <v-col cols="2">{{ record.gamesPlayed }}</v-col>
      <v-col cols="1"> {{ ((record.wins / record.gamesPlayed) * 100).toFixed(2) }}% </v-col>
    </v-row>

    <hr />

    <v-select v-model="selectedEntrant" :items="entrants"> </v-select>

    <v-row v-for="[matchup, record] in filteredRecords" :key="matchup">
      <v-col cols="4">{{ matchup }}</v-col>
      <v-col cols="2">{{ record.firstWins }}</v-col>
      <v-col cols="2">{{ record.secondWins }}</v-col>
      <v-col cols="2">{{ record.ties }}</v-col>
      <v-col cols="2">{{ record.gamesPlayed }}</v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { allAgents, removeElement } from "@/core";
import { useDeckStore } from "@/stores";
import type { BattleRecord, MassSimulatorFromWorkerMessage } from "@/types";
import { MassAgentSimulatorWorker, MassDeckSimulatorWorker } from "@/workers";

interface DeckRecord {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
}

const deckStore = useDeckStore();

const matchupRecords = reactive<Record<string, BattleRecord>>({});
const overallRecords = reactive<Record<string, DeckRecord>>({});

const useAgents = ref(false);
const entrants = ref(["none"]);
const selectedEntrant = ref("none");
const filteredRecords = computed(() =>
  Object.entries(matchupRecords).filter(([matchupName]) =>
    matchupName.includes(selectedEntrant.value)
  )
);

onMounted(() => {
  const allEntrants = useAgents.value
    ? Object.keys(allAgents)
    : Object.keys(deckStore.AllDecks).filter((x) => x.includes("Meta"));
  entrants.value = allEntrants.slice();
  selectedEntrant.value = allEntrants[0] ?? "none";

  if (useAgents.value) {
    removeElement(allEntrants, "BetterRandomAgent");
  }

  allEntrants.forEach((entrant) => {
    overallRecords[entrant] = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
  });

  const worker = useAgents.value ? new MassAgentSimulatorWorker() : new MassDeckSimulatorWorker();
  const previousEvents: Record<string, BattleRecord> = {};

  worker.onmessage = (event: MessageEvent<MassSimulatorFromWorkerMessage>) => {
    const { matchup, firstDeck, secondDeck } = event.data;

    const matchupKey = `${firstDeck} v. ${secondDeck}`;
    matchupRecords[matchupKey] = matchup;

    let { gamesPlayed, firstWins, secondWins, ties } = matchup;

    if (previousEvents[matchupKey]) {
      const previousEvent = previousEvents[matchupKey];
      gamesPlayed = matchup.gamesPlayed - previousEvent.gamesPlayed;
      firstWins = matchup.firstWins - previousEvent.firstWins;
      secondWins = matchup.secondWins - previousEvent.secondWins;
      ties = matchup.ties - previousEvent.ties;
    }

    if (event.data.type === "matchupComplete") {
      delete previousEvents[matchupKey];
    } else if (event.data.type === "matchupProgress") {
      previousEvents[matchupKey] = event.data.matchup;
    }

    const record1 = overallRecords[firstDeck]!;
    record1.gamesPlayed += gamesPlayed;
    record1.wins += firstWins;
    record1.losses += secondWins;
    record1.ties += ties;

    const record2 = overallRecords[secondDeck]!;
    record2.gamesPlayed += gamesPlayed;
    record2.wins += secondWins;
    record2.losses += firstWins;
    record2.ties += ties;
  };

  worker.postMessage({
    type: "start",
    entrants: allEntrants,
  });
});
</script>
