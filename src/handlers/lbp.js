import {swapHandler} from "./xyk.js";
import {notInRouter} from "./router.js";

export default function lbpHandler(events) {
  events
    .onFilter('lbp', 'SellExecuted', notInRouter, sellHandler)
    .onFilter('lbp', 'BuyExecuted', notInRouter, buyHandler)
}

async function sellHandler({event}) {
  const {who, assetIn, assetOut, amount, salePrice: amountOut, feeAsset, feeAmount} = event.data;
  const amountIn = Number(assetIn) === Number(feeAsset) ? amount.add(feeAmount) : amount;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}

async function buyHandler({event}) {
  const {who, assetIn, assetOut, amount: amountIn, buyPrice: amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut});
}
