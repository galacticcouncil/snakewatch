import {api} from "../api.js";
import {getAlerts} from "../utils/alerts.js";

// Addresses already holding bytecode, so normal calls to them are skipped without a chain
// read. Seeded once at init from evm.accountCodes and extended as new deploys are seen.
const knownContracts = new Set();

// Frontier emits evm.Created only for top-level deploys; contracts deployed through a
// factory / CREATE2 surface as ethereum.Executed + evm.Log with no Created event. Catch
// every deployment by spotting addresses whose bytecode went from empty to non-empty
// within the block — covers factory, CREATE2 and top-level alike.
export default function deploymentHandler(events) {
  if (!getAlerts().deploymentsEnabled()) return; // alert disabled → don't watch anything

  events.on('ethereum', 'Executed', executedHandler);
  seedKnownContracts().catch(e => console.error('deployment alert: failed to seed known contracts', e));
}

async function seedKnownContracts() {
  const keys = await api().query.evm.accountCodes.keys();
  for (const key of keys) knownContracts.add(key.args[0].toString().toLowerCase());
  console.log(`deployment alert: seeded ${knownContracts.size} known contracts`);
}

async function executedHandler({event, siblings, blockNumber, blockHash}) {
  const candidates = candidateAddresses(event, siblings);
  if (!candidates.size) return;

  let parentHash;
  for (const address of candidates) {
    if (knownContracts.has(address)) continue; // deployed before — not news

    parentHash ??= await api().rpc.chain.getBlockHash(blockNumber - 1);
    const [before, after] = await Promise.all([
      api().query.evm.accountCodes.at(parentHash, address),
      api().query.evm.accountCodes.at(blockHash, address),
    ]);
    if (after.toHex() === '0x') continue; // not a contract (EOA / empty call target)

    knownContracts.add(address); // remember so we never re-check it
    if (before.toHex() === '0x') {
      await getAlerts().checkDeployment(address, blockNumber);
    }
  }
}

// EVM addresses touched by this transaction that could be freshly deployed contracts:
// the call target and any log-emitting contracts in the same extrinsic.
function candidateAddresses({data: {to}}, siblings) {
  const addresses = new Set();
  if (to) addresses.add(to.toString().toLowerCase());
  for (const {section, method, data} of siblings) {
    if (section === 'evm' && method === 'Log') {
      const address = data?.log?.address;
      if (address) addresses.add(address.toString().toLowerCase());
    }
  }
  return addresses;
}
