import { BetterRandomAgent } from "@/models/agents";
import { GameState } from "@/models/GameState";
import type { BattleRecord, DeckInfo } from "@/types";

const newBattleRecord = (firstDeck: string, secondDeck: string) => ({
  firstDeck,
  secondDeck,
  gamesPlayed: 0,
  firstWins: 0,
  secondWins: 0,
  ties: 0,
});

const matchupRecords: Record<string, BattleRecord> = {};

const importedDecks = (await import("@/assets/decks.json")).default as Record<
  string,
  Record<string, DeckInfo>
>;

const allDecks = { ...importedDecks.A1 };
const deckNames = Object.keys(allDecks) as string[];

const timeLimit = 5 * 1e3;
for (const deck1 of deckNames) {
  for (const deck2 of deckNames.slice(deckNames.indexOf(deck1))) {
    console.log("Next matchup:", deck1, "v.", deck2);
    const loops = 500 * (deck1 == deck2 ? 1 : 2);

    const agent1 = new BetterRandomAgent("Player1", allDecks[deck1]);
    const agent2 = new BetterRandomAgent("Player2", allDecks[deck2]);

    matchupRecords[deck1 + " v. " + deck2] = newBattleRecord(deck1, deck2);
    if (deck1 != deck2) {
      matchupRecords[deck2 + " v. " + deck1] = newBattleRecord(deck2, deck1);
    }

    const startTime = new Date().valueOf();
    for (let i = 0; i < loops; i++) {
      const game = new GameState(agent1, agent2);
      const first = game.AttackingPlayer.Name;
      const second = game.DefendingPlayer.Name;
      const matchupName =
        first == "Player1" ? deck1 + " v. " + deck2 : deck2 + " v. " + deck1;
      const matchup = matchupRecords[matchupName];

      matchup.gamesPlayed++;

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
        } else if (logEvent.winner == second) {
          matchup.secondWins++;
        } else {
          matchup.ties++;
        }
      }

      if (new Date().valueOf() - startTime > timeLimit) {
        console.log("Timed out running matchup", matchupName);
        break;
      }
    }

    self.postMessage({
      type: "matchupComplete",
      matchup: matchupRecords[deck1 + " v. " + deck2],
      firstDeck: deck1,
      secondDeck: deck2,
    });
    if (deck1 != deck2) {
      self.postMessage({
        type: "matchupComplete",
        matchup: matchupRecords[deck2 + " v. " + deck1],
        firstDeck: deck2,
        secondDeck: deck1,
      });
    }
  }
}

console.log(matchupRecords);
