import {swapHandler} from "./xyk.js";
import {notInDca} from "./dca.js";
import {emojify} from "../utils/emojify.js";

export default function routerHandler(events) {
  events
    .onFilter('router', 'RouteExecuted', notInDca, routeExecutedHandler)
}

export function notInRouter({siblings}) {
  return siblings.find(({method}) => ['RouteExecuted'].includes(method)) === undefined;
}

function routeExecutedHandler({event, siblings}) {
  const {who} = siblings.find(({method}) => method === 'TransactionFeePaid').data;
  const {assetIn, assetOut, amountIn, amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, emojify(who));
}
