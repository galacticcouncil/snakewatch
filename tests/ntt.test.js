import ethers from "ethers";
import nttManagerAbi from "../src/resources/ntt-manager.abi.js";
import {
  NTT_DEPLOYMENTS,
  formatNttRecipient,
  isNttTransfer,
  knownNttAsset,
  knownNttContract,
  nttExecutionFailure,
  wormholeChain,
} from "../src/utils/ntt.js";

describe("NTT deployment metadata", () => {
  it("pins eleven unique manager/transceiver pairs", () => {
    expect(NTT_DEPLOYMENTS).toHaveLength(11);
    expect(new Set(NTT_DEPLOYMENTS.map(({assetId}) => assetId)).size).toBe(11);
    expect(new Set(NTT_DEPLOYMENTS.flatMap(({manager, transceiver}) =>
      [manager.toLowerCase(), transceiver.toLowerCase()])).size).toBe(22);
  });

  it("looks contracts and assets up without address-case sensitivity", () => {
    const deployment = NTT_DEPLOYMENTS[0];
    expect(knownNttContract(deployment.manager.toUpperCase())).toMatchObject({
      assetId: deployment.assetId,
      component: "manager",
    });
    expect(knownNttContract(deployment.transceiver)).toMatchObject({
      assetId: deployment.assetId,
      component: "transceiver",
    });
    expect(knownNttAsset(deployment.assetId)).toBe(deployment);
  });

  it("formats recipients according to the destination chain", () => {
    const evmRecipient = `0x${"00".repeat(12)}${"11".repeat(20)}`;
    const bytes32Recipient = `0x${"22".repeat(32)}`;

    expect(formatNttRecipient(evmRecipient, 2)).toBe(ethers.utils.getAddress(`0x${"11".repeat(20)}`));
    expect(formatNttRecipient(bytes32Recipient, 1)).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(formatNttRecipient(bytes32Recipient, 21)).toBe(bytes32Recipient);
    expect(wormholeChain(30)).toBe("Base");
  });
});

describe("NTT event recognition", () => {
  const iface = new ethers.utils.Interface(nttManagerAbi);
  const deployment = NTT_DEPLOYMENTS[0];

  const substrateLog = ({data, topics}, address = deployment.manager) => ({
    section: "evm",
    method: "Log",
    data: {
      log: {
        address,
        toHuman: () => ({address, data, topics}),
      },
    },
  });

  it("recognizes detailed TransferSent logs from a known manager", () => {
    const fragment = iface.getEvent("TransferSent(bytes32,bytes32,uint256,uint256,uint16,uint64)");
    const encoded = iface.encodeEventLog(fragment, [
      `0x${"11".repeat(32)}`,
      `0x${"22".repeat(32)}`,
      1000,
      0,
      2,
      7,
    ]);

    expect(isNttTransfer({siblings: [substrateLog(encoded)]})).toBe(true);
  });

  it("ignores the same event signature from an unknown contract", () => {
    const fragment = iface.getEvent("TransferSent(bytes32,bytes32,uint256,uint256,uint16,uint64)");
    const encoded = iface.encodeEventLog(fragment, [
      `0x${"11".repeat(32)}`,
      `0x${"22".repeat(32)}`,
      1000,
      0,
      2,
      7,
    ]);

    expect(isNttTransfer({
      siblings: [substrateLog(encoded, `0x${"ff".repeat(20)}`)],
    })).toBe(false);
  });

  it("classifies actionable runtime failures at known NTT contracts", () => {
    const mintLimit = ethers.utils.id("MintLimitReached()").slice(0, 10);
    const failure = nttExecutionFailure({
      data: {
        to: deployment.transceiver,
        extraData: {toHex: () => mintLimit},
      },
    });

    expect(failure).toMatchObject({
      code: "mint_limit_reached",
      deployment: {assetId: deployment.assetId, component: "transceiver"},
    });
  });

  it("does not classify arbitrary user reverts as operational NTT failures", () => {
    expect(nttExecutionFailure({
      data: {
        to: deployment.manager,
        extraData: {toHex: () => ethers.utils.id("TransferAmountHasDust(uint256,uint256)").slice(0, 10)},
      },
    })).toBeNull();
  });
});
