import ethers from "ethers";
import bilVaultAbi from "../src/resources/bil-vault.abi.js";
import {realDepositor, isBilPool, BIL_POOL_ADDRESS} from "../src/handlers/bil-depositor.js";

describe("BIL pool carve-out", () => {
  const withAddress = address => ({event: {data: {log: {address: {toString: () => address}}}}});
  it("flags evm.Log from the BIL pool", () => {
    expect(isBilPool(withAddress(BIL_POOL_ADDRESS.toUpperCase()))).toBe(true);
  });
  it("ignores other pools / malformed payloads", () => {
    expect(isBilPool(withAddress("0x" + "11".repeat(20)))).toBe(false);
    expect(isBilPool({})).toBeFalsy();
  });
});

describe("BIL deposit attribution", () => {
  // Deposits route through BILDepositZap, so the vault's Deposited event names
  // the zap. The real depositor is the pool Supply's onBehalfOf in the same
  // extrinsic. realDepositor() must recover it from the sibling evm.Log events.
  const supply = new ethers.utils.Interface([
    "event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)",
  ]);
  const ZAP = "0x646fd203bbcf19b35d79f58413bb07450fdbb1db";
  const RESERVE = "0x0000000000000000000000000000000100000226";

  // Mock a sibling evm.Log event the way processEvents/onLog expose it.
  const evmLog = (address, {topics, data}) => ({
    section: "evm",
    method: "Log",
    data: {log: {toHuman: () => ({address, topics, data})}},
  });
  const supplyLog = (address, onBehalfOf) =>
    evmLog(address, supply.encodeEventLog(supply.getEvent("Supply"), [RESERVE, ZAP, onBehalfOf, 100, 0]));

  it("uses the pool Supply onBehalfOf as the depositor", () => {
    const user = "0x" + "ab".repeat(20);
    const payload = {
      siblings: [
        {section: "balances", method: "Transfer"}, // non-evm sibling is skipped
        supplyLog(BIL_POOL_ADDRESS, user),
      ],
    };
    expect(realDepositor(payload, ZAP).toLowerCase()).toBe(user);
  });

  it("ignores Supply logs from other pools", () => {
    const user = "0x" + "cd".repeat(20);
    const payload = {siblings: [supplyLog("0x" + "11".repeat(20), user)]};
    expect(realDepositor(payload, ZAP)).toBe(ZAP); // wrong pool → fallback
  });

  it("falls back to the vault arg when there is no Supply sibling", () => {
    expect(realDepositor({siblings: []}, ZAP)).toBe(ZAP);
    expect(realDepositor({}, ZAP)).toBe(ZAP);
  });
});

describe("BIL vault ABI", () => {
  const iface = new ethers.utils.Interface(bilVaultAbi);

  const roundtrip = (name, values) => {
    const fragment = iface.getEvent(name);
    const {data, topics} = iface.encodeEventLog(fragment, values);
    return iface.parseLog({data, topics});
  };

  it("decodes Deposited", () => {
    const user = "0x" + "11".repeat(20);
    const {name, args} = roundtrip("Deposited", [user, 1000, 900, 7]);
    expect(name).toBe("Deposited");
    expect(args.user.toLowerCase()).toBe(user);
    expect(args.hollarAmount.toNumber()).toBe(1000);
    expect(args.bilMinted.toNumber()).toBe(900);
    expect(args.tokenId.toNumber()).toBe(7);
  });

  it("decodes RedemptionRequested", () => {
    const user = "0x" + "22".repeat(20);
    const {args} = roundtrip("RedemptionRequested", [3, user, 500]);
    expect(args.requestId.toNumber()).toBe(3);
    expect(args.user.toLowerCase()).toBe(user);
    expect(args.bilAmount.toNumber()).toBe(500);
  });

  it("decodes RedemptionFulfilled", () => {
    const user = "0x" + "33".repeat(20);
    const {args} = roundtrip("RedemptionFulfilled", [4, user, 480, 500]);
    expect(args.requestId.toNumber()).toBe(4);
    expect(args.hollarAmount.toNumber()).toBe(480);
    expect(args.bilBurned.toNumber()).toBe(500);
  });

  it("decodes RedemptionCancelled", () => {
    const {args} = roundtrip("RedemptionCancelled", [5, 250]);
    expect(args.requestId.toNumber()).toBe(5);
    expect(args.bilReturned.toNumber()).toBe(250);
  });

  it("decodes Withdraw", () => {
    const [a, b, c] = ["0x" + "44".repeat(20), "0x" + "55".repeat(20), "0x" + "66".repeat(20)];
    const {args} = roundtrip("Withdraw", [a, b, c, 700, 650]);
    expect(args.receiver.toLowerCase()).toBe(b);
    expect(args.assets.toNumber()).toBe(700);
    expect(args.shares.toNumber()).toBe(650);
  });
});
