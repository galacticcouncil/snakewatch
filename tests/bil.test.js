import ethers from "ethers";
import bilVaultAbi from "../src/resources/bil-vault.abi.js";

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
