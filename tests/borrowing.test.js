import {BIL_MONEY_MARKET_POOL_ADDRESS, borrowMarketFlag} from "../src/markets.js";

describe("borrow market flag", () => {
  it("marks the checksummed BIL pool address", () => {
    const address = {toString: () => "0x69310FdA58c819aD82df7d2Cb61841C853337a53"};
    expect(borrowMarketFlag(address)).toBe(" 🇧🇷");
  });

  it("marks the lowercase BIL pool address", () => {
    expect(borrowMarketFlag(BIL_MONEY_MARKET_POOL_ADDRESS)).toBe(" 🇧🇷");
  });

  it("does not mark another money-market pool", () => {
    expect(borrowMarketFlag("0x" + "77".repeat(20))).toBe("");
  });
});
