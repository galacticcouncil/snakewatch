import {swapHandler} from "./xyk.js";

export default function lbpHandler(events) {
  events
    .on('lbp', 'SellExecuted', sellHandler)
    .on('lbp', 'BuyExecuted', buyHandler)
}

async function sellHandler({event}) {
  const {who, assetIn, assetOut, amount, salePrice: amountOut, feeAsset, feeAmount} = event.data;
  const amountIn = Number(assetIn) === Number(feeAsset) ? amount.add(feeAmount) : amount;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, '⚙');
}

async function buyHandler({event}) {
  const {who, assetIn, assetOut, amount: amountIn, buyPrice: amountOut} = event.data;
  return swapHandler({who, assetIn, assetOut, amountIn, amountOut}, '⚙');
}