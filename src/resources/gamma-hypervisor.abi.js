// Event-only ABI for the Gamma Hypervisor (the concentrated-liquidity vault
// managing the aDOT/HOLLAR pool). Only the two lifecycle events the Gamma feed
// reports are declared; Rebalance / ZeroBurn are keeper noise and stay out.
//
// Deposits arrive via UniProxy.deposit, which calls Hypervisor.deposit with
// `from = msg.sender`, so `sender` here is the real depositor (the token
// source) and `to` the share recipient. Withdrawals are called on the
// Hypervisor directly and require `from == msg.sender`, so `sender` is the
// share owner and `to` the asset recipient.
export default [
  {
    anonymous: false,
    name: 'Deposit',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'address', name: 'sender', type: 'address'},
      {indexed: true, internalType: 'address', name: 'to', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'amount0', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'amount1', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'Withdraw',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'address', name: 'sender', type: 'address'},
      {indexed: true, internalType: 'address', name: 'to', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'amount0', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'amount1', type: 'uint256'},
    ],
  },
];
