import type { GameLogger } from "../logging";

interface LogSetup {
  logger: GameLogger;
  name: string;
}

export class CoinFlipper {
  private setup?: LogSetup;

  constructor(setup?: LogSetup) {
    this.setup = setup;
  }

  private coinFlip = () => Math.random() >= 0.5;

  singleCoinFlip = () => {
    const result = this.coinFlip();
    this.setup?.logger.addEntry({
      type: "coinFlip",
      player: this.setup.name,
      result: result ? "Heads" : "Tails",
    });
    return result;
  };

  multiCoinFlip = (count: number) => {
    let heads = 0;
    const results = [];

    for (let i = 0; i < count; i++) {
      const result = this.coinFlip();
      results.push(result);
      heads += +result;
    }

    this.setup?.logger.addEntry({
      type: "coinMultiFlip",
      player: this.setup.name,
      flips: count,
      results: results.map((x) => (x ? "Heads" : "Tails")),
    });

    return { heads, results };
  };

  untilTailsCoinFlip = () => {
    let heads = 0;
    const results = [];

    while (true) {
      const result = this.coinFlip();
      results.push(result);
      if (!result) break;
      heads++;
    }

    this.setup?.logger.addEntry({
      type: "coinFlipUntilTails",
      player: this.setup.name,
      results: results.map((x) => (x ? "Heads" : "Tails")),
    });

    return { heads, results };
  };
}
