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

    <v-row v-for="(record, matchup) in matchupRecords" :key="matchup">
      <v-col cols="4">{{ matchup }}</v-col>
      <v-col cols="2">{{ record.firstWins }}</v-col>
      <v-col cols="2">{{ record.secondWins }}</v-col>
      <v-col cols="2">{{ record.ties }}</v-col>
      <v-col cols="2">{{ record.gamesPlayed }}</v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useDeckStore } from "@/stores";
import type { BattleRecord } from "@/types";
import MyWorker from "@/workers/massSimulatorWorker.ts?worker";
import { onMounted, reactive } from "vue";

interface DeckRecord {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
}

const deckStore = useDeckStore();

const matchupRecords = reactive<Record<string, BattleRecord>>({});
const overallRecords = reactive<Record<string, DeckRecord>>({});

onMounted(async () => {
  await deckStore.ensureDecksLoaded();

  const allDecks = { ...deckStore.Decks.A1 };

  Object.keys(allDecks).forEach((deck) => {
    overallRecords[deck] = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
  });

  const worker = new MyWorker();

  worker.onmessage = (
    event: MessageEvent<{
      type: "matchupComplete";
      matchup: BattleRecord;
      firstDeck: string;
      secondDeck: string;
    }>,
  ) => {
    console.log("Matchup complete:", event.data);
    const { matchup, firstDeck, secondDeck } = event.data;

    const matchupKey = `${firstDeck} v. ${secondDeck}`;
    matchupRecords[matchupKey] = matchup;

    const record1 = overallRecords[firstDeck];
    record1.gamesPlayed += matchup.gamesPlayed;
    record1.wins += matchup.firstWins;
    record1.losses += matchup.secondWins;
    record1.ties += matchup.ties;

    const record2 = overallRecords[secondDeck];
    record2.gamesPlayed += matchup.gamesPlayed;
    record2.wins += matchup.secondWins;
    record2.losses += matchup.firstWins;
    record2.ties += matchup.ties;
  };
});
</script>
