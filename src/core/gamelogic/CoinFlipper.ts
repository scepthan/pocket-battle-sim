import type { Player } from "./Player";
import type { PlayerStatus } from "./types";

export class CoinFlipper {
  private player?: Player;
  private usedPlayerStatus: PlayerStatus | null = null;
  private removePlayerStatus = () => {
    if (!this.usedPlayerStatus) return;
    if (this.usedPlayerStatus.id === undefined) {
      console.warn("Attempting to remove a player status without an ID:", this.usedPlayerStatus);
      return;
    }

    this.player?.removePlayerStatus(this.usedPlayerStatus.id ?? "");
    this.usedPlayerStatus = null;
  };

  constructor(player?: Player) {
    this.player = player;
  }

  private coinFlip = () => {
    if (this.player && this.usedPlayerStatus === null) {
      const nextCoinFlipStatus = this.player.PlayerStatuses.find((s) => s.type === "NextCoinFlip");
      if (nextCoinFlipStatus) {
        this.usedPlayerStatus = nextCoinFlipStatus;
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
