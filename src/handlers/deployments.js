import {getAlerts} from "../utils/alerts.js";

export default function deploymentHandler(events) {
  events.on('evm', 'Created', createdHandler);
}

async function createdHandler({event, blockNumber}) {
  const {address} = event.data;
  const alerts = getAlerts();
  await alerts.checkDeployment(address.toString(), blockNumber);
}
