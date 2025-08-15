import type { Player } from "./Player";

export class CoinFlipper {
  private player?: Player;

  constructor(player?: Player) {
    this.player = player;
  }

  private coinFlip = () => Math.random() >= 0.5;

  singleCoinFlip = () => {
    const result = this.coinFlip();
    this.player?.logger.coinFlip(this.player, result);
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

    this.player?.logger.coinMultiFlip(this.player, results);

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

    this.player?.logger.coinFlipUntilTails(this.player, results);

    return { heads, results };
  };
}
