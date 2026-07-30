// Event-only ABI for the BIL vault (ERC-4626 / ERC-7540 wrapper around
// Decentral Protocol positions). Only the lifecycle events the BIL feed
// reports are declared. `RedemptionFulfilled` / `RedemptionPartiallyFulfilled`
// are emitted under DELEGATECALL from QueueLib but still logged at the vault's
// own address, so they parse and address-filter exactly like the rest.
export default [
  {
    anonymous: false,
    name: 'Deposited',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'address', name: 'user', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'hollarAmount', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'bilMinted', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'RedemptionRequested',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'uint256', name: 'requestId', type: 'uint256'},
      {indexed: true, internalType: 'address', name: 'user', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'bilAmount', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'RedemptionFulfilled',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'uint256', name: 'requestId', type: 'uint256'},
      {indexed: true, internalType: 'address', name: 'user', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'hollarAmount', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'bilBurned', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'RedemptionPartiallyFulfilled',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'uint256', name: 'requestId', type: 'uint256'},
      {indexed: true, internalType: 'address', name: 'user', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'hollarAmount', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'bilBurned', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'RedemptionCancelled',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'uint256', name: 'requestId', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'bilReturned', type: 'uint256'},
    ],
  },
  {
    anonymous: false,
    name: 'Withdraw',
    type: 'event',
    inputs: [
      {indexed: true, internalType: 'address', name: 'sender', type: 'address'},
      {indexed: true, internalType: 'address', name: 'receiver', type: 'address'},
      {indexed: true, internalType: 'address', name: 'owner', type: 'address'},
      {indexed: false, internalType: 'uint256', name: 'assets', type: 'uint256'},
      {indexed: false, internalType: 'uint256', name: 'shares', type: 'uint256'},
    ],
  },
];
