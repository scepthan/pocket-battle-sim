import { allDecks } from "@/assets";
import { allAgents, Game, randomElement } from "@/core";
import type { BattleRecord, MassSimulatorToWorkerMessage } from "@/types";

const newBattleRecord = (firstDeck: string, secondDeck: string) => ({
  firstDeck,
  secondDeck,
  gamesPlayed: 0,
  firstWins: 0,
  secondWins: 0,
  ties: 0,
});

const start = async (agentNames: string[]) => {
  const matchupRecords: Record<string, BattleRecord> = {};
  console.log("Starting head-to-head simulation of agents:", agentNames);

  for (const agentName1 of agentNames) {
    for (const agentName2 of agentNames.slice(agentNames.indexOf(agentName1))) {
      console.log("Next matchup:", agentName1, "v.", agentName2);
      const loops = 10000;

      const Agent1 = allAgents[agentName1];
      const Agent2 = allAgents[agentName2];

      matchupRecords[agentName1 + " v. " + agentName2] = newBattleRecord(agentName1, agentName2);
      if (agentName1 != agentName2) {
        matchupRecords[agentName2 + " v. " + agentName1] = newBattleRecord(agentName2, agentName1);
      }

      const startTime = Date.now();
      for (let i = 0; i < loops; i++) {
        const agent1 = new Agent1("Player1", randomElement(Object.values(allDecks)));
        const agent2 = new Agent2("Player2", randomElement(Object.values(allDecks)));
        const game = new Game(agent1, agent2);
        const first = game.AttackingPlayer.Name;
        const second = game.DefendingPlayer.Name;
        const matchupName =
          first == "Player1" ? agentName1 + " v. " + agentName2 : agentName2 + " v. " + agentName1;
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
        if ((i + 1) % 100 == 0) {
          self.postMessage({
            type: "matchupProgress",
            matchup: matchupRecords[agentName1 + " v. " + agentName2],
            firstDeck: agentName1,
            secondDeck: agentName2,
          });
          if (agentName1 != agentName2) {
            self.postMessage({
              type: "matchupProgress",
              matchup: matchupRecords[agentName2 + " v. " + agentName1],
              firstDeck: agentName2,
              secondDeck: agentName1,
            });
          }
        }
      }

      self.postMessage({
        type: "matchupComplete",
        matchup: matchupRecords[agentName1 + " v. " + agentName2],
        firstDeck: agentName1,
        secondDeck: agentName2,
      });
      if (agentName1 != agentName2) {
        self.postMessage({
          type: "matchupComplete",
          matchup: matchupRecords[agentName2 + " v. " + agentName1],
          firstDeck: agentName2,
          secondDeck: agentName1,
        });
      }
      console.log(
        `Matchup ${agentName1} v. ${agentName2} completed in ${Date.now() - startTime}ms`
      );
    }
  }

  console.log(matchupRecords);
};

self.onmessage = async (event: MessageEvent<MassSimulatorToWorkerMessage>) => {
  if (event.data.type == "start") {
    await start(event.data.entrants);
  }
};
