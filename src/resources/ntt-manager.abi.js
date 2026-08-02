// Minimal Wormhole NTT v2 manager ABI. Keep this event-only: Snakewatch does
// not call the contracts and only needs enough surface to decode Hydration logs.
export default [
  "event TransferSent(bytes32 indexed recipient, bytes32 indexed refundAddress, uint256 amount, uint256 fee, uint16 recipientChain, uint64 msgSequence)",
  "event TransferSent(bytes32 indexed digest)",
  "event TransferRedeemed(bytes32 indexed digest)",
  "event OutboundTransferRateLimited(address indexed sender, uint64 sequence, uint256 amount, uint256 currentCapacity)",
  "event OutboundTransferCancelled(uint256 sequence, address recipient, uint256 amount)",
  "event InboundTransferQueued(bytes32 digest)",
  "event Paused(bool paused)",
  "event NotPaused(bool notPaused)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event PauserTransferred(address indexed oldPauser, address indexed newPauser)",
  "event Upgraded(address indexed implementation)",
  "event PeerUpdated(uint16 indexed chainId_, bytes32 oldPeerContract, uint8 oldPeerDecimals, bytes32 peerContract, uint8 peerDecimals)",
  "event ThresholdChanged(uint8 oldThreshold, uint8 threshold)",
  "event TransceiverAdded(address transceiver, uint256 transceiversNum, uint8 threshold)",
  "event TransceiverRemoved(address transceiver, uint8 threshold)",
  "event OutboundTransferLimitUpdated(uint256 oldLimit, uint256 newLimit)",
  "event InboundTransferLimitUpdated(uint16 indexed chainId, uint256 oldLimit, uint256 newLimit)",
];
