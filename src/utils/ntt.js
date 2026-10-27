import ethers from "ethers";
import {base58Encode} from "@polkadot/util-crypto";
import {hexToU8a} from "@polkadot/util";
import nttManagerAbi from "../resources/ntt-manager.abi.js";

export const WORMHOLE_CHAINS = Object.freeze({
  1: "Solana",
  2: "Ethereum",
  21: "Sui",
  30: "Base",
  73: "Hydration",
});

// Hydration legs from the audited production deployment manifests. These are
// intentionally static so a cleared minter or compromised registry entry does
// not make Snakewatch forget the contract it is meant to monitor.
//
// `hub` is the origin-chain locking leg that must custody enough underlying to
// back the Hydration issuance. Custody is balance-based on every platform
// (evm: token.balanceOf(manager); solana: the custody token account; sui: the
// State object's balance), so the backing monitor just reads that balance.
// Cross-checked against hydration-ntt/ops/tokens/<sym>/deployment.json and the
// production @galacticcouncil/xc-cfg NTT config.
export const NTT_DEPLOYMENTS = Object.freeze([
  {assetId: 18, symbol: "DAI", peerChainId: 2, manager: "0xcFd576F88C90844AEBF45378Fd09931281D8b14d", transceiver: "0xe8660CA48f6f4D98BC48DB7Dd07C1a8E555801eA", hub: {custody: "0x804F123f75cCa0A9c0Cba341F82f4A4DA86a5259", token: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18}},
  {assetId: 19, symbol: "WBTC", peerChainId: 2, manager: "0x6BFca089916c045b0Ca4A09B655aF9F926189993", transceiver: "0x9a8a1ab288f6749Ce5626DEE1B5d59441BdC187F", hub: {custody: "0x081b76AC3cFb65DCe93961d66cea44A74EC8Ef28", token: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8}},
  {assetId: 20, symbol: "WETH", peerChainId: 2, manager: "0xB5cEf790D52A57fa619eD96eDd64c5328F3DCFb7", transceiver: "0x8acce9CA511d5D7213F8C3f813B8916087cd00ae", hub: {custody: "0x283B14B5Dd352e32154Df014EA96834F395E04b6", token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18}},
  {assetId: 21, symbol: "USDC", peerChainId: 2, manager: "0xEcEab64542A875C4472671D9Ed1E690cdD4e28fC", transceiver: "0x0d7488B39AA64468a709eC3b3d354DeFE539eD97", hub: {custody: "0x447b2c7485A3d6813F8197E605b10BcCD8dd8398", token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6}},
  {assetId: 23, symbol: "USDT", peerChainId: 2, manager: "0x5E6C488103b47F804824AE15861638af4C436795", transceiver: "0xd2a16B736F32Df7C0DE72838837656FE0f85Ac0F", hub: {custody: "0x9fbd9F16cE7Fa17097E91cc36DC1B7b47aDCa9De", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6}},
  {assetId: 40, symbol: "jitoSOL", peerChainId: 1, manager: "0xcE73C15B9ED02413066DE5B904A36F8e8f9B5331", transceiver: "0xF38D9C3bA6999Dc331b32B416083Fd7e02D17B04", hub: {custody: "GL9A9wzcn2aPJCaab2NaeFv4SmUadEGS3iY8PtdqFU2Q", decimals: 9}},
  {assetId: 43, symbol: "PRIME", peerChainId: 1, manager: "0xFCaF4aA069C565d25539028970703F01e47D3E0B", transceiver: "0x4e7b1E55D2354d4Dc6ABD876096Dc201de0541D1", hub: {custody: "7ND1JXFtoH8nn4rvRUvukDwAKgGuJ6uDtFTfTaR9VXiC", decimals: 6}},
  {assetId: 44, symbol: "EURC", peerChainId: 30, manager: "0x8dd1286A29dF5a2785FB638d6fB1598144Cfbc4C", transceiver: "0x2e84fac378D67Dc2e11026fB4919E80263a87375", hub: {custody: "0xD1dc3517732c98502b5c1ba2389AcA9E9016d89a", token: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", decimals: 6}},
  {assetId: 1000745, symbol: "sUSDS", peerChainId: 2, manager: "0x1973E7044d9A7C7bB2d6ea1693A296a9e4B7E448", transceiver: "0x68Ecadd7934D4FcFEABAfB209C95D379B96400cb", hub: {custody: "0x5085A4863f89eC9553F70187EE73B5aAe0fd14b5", token: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD", decimals: 18}},
  {assetId: 1000752, symbol: "SOL", peerChainId: 1, manager: "0x9e200C0f28D92D296b201D96C8269d3CAFFfA9FF", transceiver: "0x2F04AcF249091425d51e67EeA3C3161ccE283202", hub: {custody: "4Z2n3D6szuyPkg2uRbm6NwvjpXzKifKQ8HvxhykknyvF", decimals: 9}},
  {assetId: 1000753, symbol: "SUI", peerChainId: 21, manager: "0x978443f00cAB6b09445140321EC73a221ebFF5F8", transceiver: "0xA224D6f4e0E276b34D91bfE6c3A5fE6838322AF7", hub: {custody: "0xa0bc45e0384140dc125f273eda89cad1434f5dee430726cf6364bdcceba1e9a3", decimals: 9}},
]);

const normalize = value => value?.toString().toLowerCase();

const contracts = new Map(NTT_DEPLOYMENTS.flatMap(deployment => [
  [normalize(deployment.manager), {...deployment, component: "manager"}],
  [normalize(deployment.transceiver), {...deployment, component: "transceiver"}],
]));
const assets = new Map(NTT_DEPLOYMENTS.map(deployment => [String(deployment.assetId), deployment]));
const managerInterface = new ethers.utils.Interface(nttManagerAbi);
const selector = signature => ethers.utils.id(signature).slice(0, 10);
const executionFailures = new Map([
  [selector("MintLimitReached()"), {
    code: "mint_limit_reached",
    description: "the Hydration runtime mint fuse rejected the delivery",
  }],
  [selector("CallerNotMinter(address)"), {
    code: "caller_not_minter",
    description: "the Hydration runtime rejected the deployed manager as this asset's minter",
  }],
]);

export function knownNttContract(address) {
  return contracts.get(normalize(address));
}

export function knownNttAsset(assetId) {
  return assets.get(String(assetId));
}

export function nttContractFromPayload({event}) {
  return knownNttContract(event?.data?.log?.address);
}

export function nttExecutionFailure(event) {
  const deployment = knownNttContract(event?.data?.to);
  if (!deployment) return null;

  const extraData = event.data.extraData;
  const output = (extraData?.toHex ? extraData.toHex() : extraData?.toString())?.toLowerCase();
  const failure = output ? executionFailures.get(output.slice(0, 10)) : null;
  return failure ? {deployment, output, ...failure} : null;
}

export function wormholeChain(chainId) {
  return WORMHOLE_CHAINS[Number(chainId)] || `Wormhole chain ${chainId}`;
}

export function formatNttRecipient(recipient, chainId) {
  const value = recipient.toString();
  switch (Number(chainId)) {
    case 1:
      return base58Encode(hexToU8a(value));
    case 2:
    case 30:
      return ethers.utils.getAddress(`0x${value.slice(-40)}`);
    case 21:
    default:
      return value;
  }
}

export function currencySibling(siblings, method, assetId) {
  return siblings.find(({section, method: siblingMethod, data}) =>
    section === "currencies"
    && siblingMethod === method
    && data?.currencyId?.toString() === String(assetId));
}

// The ordinary transfer handler would otherwise report the transferFrom into
// the manager as a whale transfer in addition to the purpose-built NTT feed.
export function isNttTransfer({siblings}) {
  return siblings.some(({section, method, data}) => {
    if (section !== "evm" || method !== "Log") return false;
    const raw = data?.log;
    if (!knownNttContract(raw?.address) || knownNttContract(raw.address).component !== "manager") return false;
    try {
      const name = managerInterface.parseLog(raw.toHuman()).name;
      return ["TransferSent", "OutboundTransferRateLimited"].includes(name);
    } catch {
      return false;
    }
  });
}
