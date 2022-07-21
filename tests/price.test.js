import dijkstrajs from "dijkstrajs";
import * as assert from "assert";

describe("Prices", () => {
  const pricesMock = {
    "0": {
      "4": 46211.85900736248,
      "5": 2001865.7388686256
    },
    "4": {
      "0": 0.00002165987
    },
    "5": {
      "0": 5.01535e-7
    }
  };

  const usdToken = '4';

  it('kusama price', async () => {
    const path = dijkstrajs.find_path(pricesMock, usdToken, '5');
    const swaps = path.map((from, i) => [from, path[i+1]]).filter(([,to]) => to);
    const price = swaps.reduce((acc, [from, to]) => acc * pricesMock[from][to], 1);
    expect(price).toBe(43.360151661348375);
  });

  it('path not found', async () => {
    try {
      dijkstrajs.find_path(pricesMock, usdToken, '6');
      assert.fail()
    } catch (e) {
      expect(e.message).toBe('Could not find a path from 4 to 6.');
    }
  });
});
