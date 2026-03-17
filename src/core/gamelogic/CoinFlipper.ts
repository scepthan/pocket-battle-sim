import type { Player } from "./Player";

export class CoinFlipper {
  private player?: Player;
  private usedPlayerStatus = false;
  private removePlayerStatus = () => {
    if (!this.player || !this.usedPlayerStatus) return;

    for (const status of this.player.PlayerStatuses) {
      if (status.type === "NextCoinFlip" && status.source === "Effect") {
        this.player.removePlayerStatus(status.id!);
      }
    }
    this.usedPlayerStatus = false;
  };

  constructor(player?: Player) {
    this.player = player;
  }

  private coinFlip = () => {
    if (this.player && !this.usedPlayerStatus) {
      const nextCoinFlipStatus = this.player.PlayerStatuses.find((s) => s.type === "NextCoinFlip");
      if (nextCoinFlipStatus) {
        this.usedPlayerStatus = true;
        return nextCoinFlipStatus.result;
      }
    }
    return Math.random() >= 0.5;
  };

  singleCoinFlip = () => {
    const result = this.coinFlip();

    this.player?.logger.coinFlip(this.player, result);
    this.removePlayerStatus();

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
    this.removePlayerStatus();

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
    this.removePlayerStatus();

    return { heads, results };
  };
}
