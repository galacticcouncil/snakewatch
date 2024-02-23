import {swapHandler} from "./xyk.js";
import {notInDca} from "./dca.js";
import {emojify} from "../utils/emojify.js";

export default function routerHandler(events) {
  events
    .onFilter('router', 'Executed', notInDca, routeExecutedHandler)
}

export function notInRouter({siblings}) {
  return siblings.find(({method}) => ['Executed'].includes(method)) === undefined;
}

function routeExecutedHandler({event, siblings}) {
  const {who} = siblings.find(({method}) => method === 'TransactionFeePaid').data;
  let {assetIn, assetOut, amountIn, amountOut} = event.data;
  if (isBuy({event, siblings})) {
    
  }
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, emojify(who));
}

const isBuy = ({event, siblings}) => siblings
    .slice(0, siblings.indexOf(event))
    .reverse()
    .find(({method}) => method === 'BuyExecuted');