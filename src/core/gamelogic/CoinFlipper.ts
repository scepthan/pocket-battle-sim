import type { GameLogger } from "../logging";
import type { Player } from "./Player";

export class CoinFlipper {
  private player?: Player;
  private logger?: GameLogger;

  constructor(player?: Player) {
    if (player) {
      this.player = player;
      this.logger = player.logger;
    }
  }

  private coinFlip = () => Math.random() >= 0.5;

  singleCoinFlip = () => {
    const result = this.coinFlip();
    this.logger?.coinFlip(this.player!, result);
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

    this.logger?.coinMultiFlip(this.player!, results);

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

    this.logger?.coinFlipUntilTails(this.player!, results);

    return { heads, results };
  };
}
