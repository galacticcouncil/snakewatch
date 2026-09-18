import ethers from "ethers";
import hypervisorAbi from "../src/resources/gamma-hypervisor.abi.js";

// Handler-level tests stay ABI / shape only: the handler module pulls the
// polkadot API chain in via currencies.js, same reason bil.test.js stays pure.
describe("Gamma Hypervisor ABI", () => {
  const iface = new ethers.utils.Interface(hypervisorAbi);
  const roundtrip = (name, values) => {
    const fragment = iface.getEvent(name);
    const {data, topics} = iface.encodeEventLog(fragment, values);
    return iface.parseLog({data, topics});
  };

  it("matches the on-chain Deposit / Withdraw topics", () => {
    // keccak256 of the canonical signatures — what the Hypervisor actually emits
    expect(iface.getEventTopic("Deposit"))
      .toBe(ethers.utils.id("Deposit(address,address,uint256,uint256,uint256)"));
    expect(iface.getEventTopic("Withdraw"))
      .toBe(ethers.utils.id("Withdraw(address,address,uint256,uint256,uint256)"));
  });

  it("decodes Deposit", () => {
    const [sender, to] = ["0x" + "11".repeat(20), "0x" + "22".repeat(20)];
    const {name, args} = roundtrip("Deposit", [sender, to, 3, 1000, 900]);
    expect(name).toBe("Deposit");
    expect(args.sender.toLowerCase()).toBe(sender);
    expect(args.to.toLowerCase()).toBe(to);
    expect(args.shares.toNumber()).toBe(3);
    expect(args.amount0.toNumber()).toBe(1000);
    expect(args.amount1.toNumber()).toBe(900);
  });

  it("decodes Withdraw", () => {
    const [sender, to] = ["0x" + "33".repeat(20), "0x" + "44".repeat(20)];
    const {name, args} = roundtrip("Withdraw", [sender, to, 5, 0, 700]);
    expect(name).toBe("Withdraw");
    expect(args.sender.toLowerCase()).toBe(sender);
    expect(args.to.toLowerCase()).toBe(to);
    expect(args.amount0.toNumber()).toBe(0);
    expect(args.amount1.toNumber()).toBe(700);
  });

  it("decodes a real mainnet Deposit log", () => {
    // block 14722990, tx 0xfd97d9e8…41f32 — aDOT/HOLLAR vault
    const sender = "0xc8cA46Fa2c9e4101f07BAcDc140Ac0d21C73655b";
    const {data, topics} = iface.encodeEventLog(iface.getEvent("Deposit"), [
      sender, sender, "132123269775920838091", "135643854810", "104828177104503291193",
    ]);
    const {args} = iface.parseLog({data, topics});
    expect(args.amount0.toString()).toBe("135643854810"); // 13.56 aDOT (10 dec)
    expect(args.amount1.toString()).toBe("104828177104503291193"); // 104.83 HOLLAR (18 dec)
  });
});
