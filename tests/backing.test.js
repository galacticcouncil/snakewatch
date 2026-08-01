import {normalizeTo8dp, assessBacking} from "../src/utils/backing.js";
import {NTT_DEPLOYMENTS} from "../src/utils/ntt.js";

describe("backing: normalizeTo8dp", () => {
  it("scales 18dp down to 8dp (floor)", () => {
    // 1.23456789987654321 * 1e18 -> 1.23456789 * 1e8
    expect(normalizeTo8dp(1234567899876543210n, 18)).toBe(123456789n);
  });
  it("scales 6dp up to 8dp", () => {
    expect(normalizeTo8dp(55000000000n, 6)).toBe(5500000000000n); // 55,000 * 1e8
  });
  it("is identity at 8dp", () => {
    expect(normalizeTo8dp(42n, 8)).toBe(42n);
  });
  it("accepts string / bigint raw", () => {
    expect(normalizeTo8dp("100000000", 8)).toBe(100000000n);
  });
});

describe("backing: assessBacking", () => {
  it("is sufficient when custody >= issuance", () => {
    const r = assessBacking(1000n, 1000n);
    expect(r.sufficient).toBe(true);
    expect(r.shortfall8).toBe(0n);
    expect(r.ratio).toBe(1);
  });
  it("flags a shortfall when custody < issuance", () => {
    const r = assessBacking(1000n, 400n);
    expect(r.sufficient).toBe(false);
    expect(r.shortfall8).toBe(600n);
    expect(r.ratio).toBeCloseTo(0.4);
  });
  it("treats zero issuance as trivially backed", () => {
    const r = assessBacking(0n, 0n);
    expect(r.sufficient).toBe(true);
    expect(r.shortfall8).toBe(0n);
  });
  it("respects a >1 threshold (require an over-collateralisation buffer)", () => {
    expect(assessBacking(1000n, 1000n, 1.1).sufficient).toBe(false);
    expect(assessBacking(1000n, 1100n, 1.1).sufficient).toBe(true);
  });
});

describe("backing: NTT hub-custody config integrity", () => {
  it("every deployment carries a hub custody + decimals", () => {
    for (const d of NTT_DEPLOYMENTS) {
      expect(typeof d.hub?.custody).toBe("string");
      expect(d.hub.custody.length).toBeGreaterThan(0);
      expect(Number.isInteger(d.hub.decimals)).toBe(true);
    }
  });
  it("EVM hubs (Ethereum/Base) carry an origin token for balanceOf; Solana/Sui do not require one", () => {
    for (const d of NTT_DEPLOYMENTS) {
      if (d.peerChainId === 2 || d.peerChainId === 30) {
        expect(d.hub.token).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });
});
