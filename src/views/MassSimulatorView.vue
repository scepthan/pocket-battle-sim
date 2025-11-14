<template>
  <v-container>
    <v-data-table
      :items="overallData"
      :headers="[
        { title: 'Deck', value: 'deck' },
        { title: 'Wins', value: 'wins' },
        { title: 'Losses', value: 'losses' },
        { title: 'Ties', value: 'ties' },
        { title: 'Total', value: 'gamesPlayed' },
        { title: 'Winrate', value: 'winrate' },
      ]"
      class="mb-4"
      density="compact"
      :items-per-page="25"
    />

    <hr />

    <v-select v-model="selectedEntrant" :items="entrants"> </v-select>

    <v-data-table
      :items="matchupData"
      :headers="[
        { title: 'Matchup', value: 'matchup' },
        { title: '1st Wins', value: 'firstWins' },
        { title: '2nd Wins', value: 'secondWins' },
        { title: 'Ties', value: 'ties' },
        { title: 'Total', value: 'gamesPlayed' },
      ]"
      density="compact"
      :items-per-page="25"
    />
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

const overallData = computed(() =>
  Object.entries(overallRecords).map(([deck, record]) => ({
    deck: deck,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    gamesPlayed: record.gamesPlayed,
    winrate: ((record.wins / record.gamesPlayed || 0) * 100).toFixed(2) + "%",
  }))
);

const matchupData = computed(() =>
  filteredRecords.value.map(([matchup, record]) => ({
    matchup: matchup,
    firstWins: record.firstWins,
    secondWins: record.secondWins,
    ties: record.ties,
    gamesPlayed: record.gamesPlayed,
  }))
);

onMounted(() => {
  const allEntrants = useAgents.value
    ? Object.keys(allAgents)
    : Object.keys(deckStore.BuiltinDecks).filter((x) => x.includes("Meta "));
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
