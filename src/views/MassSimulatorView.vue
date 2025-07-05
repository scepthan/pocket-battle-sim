<template>
  <v-row v-for="(record, deck) in overallRecords" :key="deck">
    <v-col cols="3">{{ deck }}</v-col>
    <v-col cols="2">{{ record.firstWins + record.secondWins }}</v-col>
    <v-col cols="2">{{
      record.gamesPlayed - (record.firstWins + record.secondWins + record.ties)
    }}</v-col>
    <v-col cols="2">{{ record.ties }}</v-col>
    <v-col cols="2">{{ record.gamesPlayed }}</v-col>
    <v-col cols="1"
      >{{
        (
          ((record.firstWins + record.secondWins) / record.gamesPlayed) *
          100
        ).toFixed(2)
      }}%</v-col
    >
  </v-row>

  <hr />

  <v-row v-for="(record, matchup) in matchupRecords" :key="matchup">
    <v-col cols="4">{{ matchup }}</v-col>
    <v-col cols="2">{{ record.firstWins }}</v-col>
    <v-col cols="2">{{ record.secondWins }}</v-col>
    <v-col cols="2">{{ record.ties }}</v-col>
    <v-col cols="2">{{ record.gamesPlayed }}</v-col>
  </v-row>
</template>

<script setup lang="ts">
import { BetterRandomAgent } from "@/models/agents";
import { GameState } from "@/models/GameState";
import type { DeckInfo } from "@/types";
import { onMounted, reactive } from "vue";

interface BattleRecord {
  gamesPlayed: number;
  firstWins: number;
  secondWins: number;
  ties: number;
}

const matchupRecords = reactive<Record<string, BattleRecord>>({});
const overallRecords = reactive<Record<string, BattleRecord>>({});

onMounted(async () => {
  console.log("Starting...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const importedDecks = (await import("@/assets/decks.json")).default as Record<
    string,
    Record<string, DeckInfo>
  >;

  const allDecks = { ...importedDecks.A1 };
  const deckNames = Object.keys(allDecks) as (keyof typeof allDecks)[];

  for (const deck of deckNames) {
    overallRecords[deck] = {
      gamesPlayed: 0,
      firstWins: 0,
      secondWins: 0,
      ties: 0,
    };
  }

  const timeLimit = 5 * 1e3;
  for (const deck1 of deckNames) {
    for (const deck2 of deckNames.slice(deckNames.indexOf(deck1))) {
      console.log("Next matchup:", deck1, "v.", deck2);
      const loops = 500 * (deck1 == deck2 ? 1 : 2);

      const agent1 = new BetterRandomAgent("Player1", allDecks[deck1]);
      const agent2 = new BetterRandomAgent("Player2", allDecks[deck2]);

      matchupRecords[deck1 + " v. " + deck2] = {
        gamesPlayed: 0,
        firstWins: 0,
        secondWins: 0,
        ties: 0,
      };
      if (deck1 != deck2) {
        matchupRecords[deck2 + " v. " + deck1] = {
          gamesPlayed: 0,
          firstWins: 0,
          secondWins: 0,
          ties: 0,
        };
      }

      const startTime = new Date().valueOf();
      for (let i = 0; i < loops; i++) {
        const game = new GameState(agent1, agent2);
        const first = game.AttackingPlayer.Name;
        const second = game.DefendingPlayer.Name;
        const matchupName =
          first == "Player1" ? deck1 + " v. " + deck2 : deck2 + " v. " + deck1;
        const matchup = matchupRecords[matchupName];
        const record1 = overallRecords[deck1];
        const record2 = overallRecords[deck2];

        matchup.gamesPlayed++;
        if (deck1 != deck2) {
          record1.gamesPlayed++;
          record2.gamesPlayed++;
        }

        try {
          await game.start();
        } catch (e) {
          console.error("Error encountered during matchup", matchupName);
          console.error(e);
          continue;
        }

        const logEvent = game.GameLog.entries.find((x) => x.type == "gameOver");
        if (logEvent) {
          if (logEvent.winner == first) {
            matchup.firstWins++;
            if (deck1 != deck2) {
              (first == "Player1" ? record1 : record2).firstWins++;
            }
          } else if (logEvent.winner == second) {
            matchup.secondWins++;
            if (deck1 != deck2) {
              (second == "Player1" ? record1 : record2).firstWins++;
            }
          } else {
            matchup.ties++;
            if (deck1 != deck2) {
              record1.ties++;
              record2.ties++;
            }
          }
        }

        if (new Date().valueOf() - startTime > timeLimit) {
          console.log("Timed out running matchup", matchupName);
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(matchupRecords);
});
</script>
