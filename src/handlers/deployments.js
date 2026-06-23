import {api} from "../api.js";
import {getAlerts} from "../utils/alerts.js";

// Frontier emits evm.Created only for top-level deploys; contracts deployed through a
// factory / CREATE2 surface as ethereum.Executed + evm.Log with no Created event. Catch
// every deployment by spotting addresses whose bytecode went from empty to non-empty
// within the block — covers factory, CREATE2 and top-level alike.
export default function deploymentHandler(events) {
  events.on('ethereum', 'Executed', executedHandler);
}

async function executedHandler({event, siblings, blockNumber, blockHash}) {
  const alerts = getAlerts();
  if (!alerts.deploymentsEnabled()) return; // skip the chain reads entirely when disabled

  const candidates = candidateAddresses(event, siblings);
  if (!candidates.size) return;

  const parentHash = await api().rpc.chain.getBlockHash(blockNumber - 1);
  for (const address of candidates) {
    const [before, after] = await Promise.all([
      api().query.evm.accountCodes.at(parentHash, address),
      api().query.evm.accountCodes.at(blockHash, address),
    ]);
    if (before.toHex() === '0x' && after.toHex() !== '0x') {
      await alerts.checkDeployment(address, blockNumber);
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
