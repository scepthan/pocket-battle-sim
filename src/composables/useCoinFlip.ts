export const useCoinFlip = () => {
  const coinFlip = () => Math.random() >= 0.5;

  const multiCoinFlip = (count: number) => {
    let heads = 0;
    const results = [];

    for (let i = 0; i < count; i++) {
      const result = coinFlip();
      results.push(result);
      heads += +result;
    }

    return { heads, results };
  };

  const untilTailsCoinFlip = () => {
    let heads = 0;
    const results = [];

    while (true) {
      const result = coinFlip();
      results.push(result);
      if (!result) break;
      heads++;
    }

    return { heads, results };
  };

  return { coinFlip, multiCoinFlip, untilTailsCoinFlip };
};
