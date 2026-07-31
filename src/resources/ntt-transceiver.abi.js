// Minimal Wormhole NTT v2 transceiver ABI for security-sensitive changes.
export default [
  "event Paused(bool paused)",
  "event NotPaused(bool notPaused)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event PauserTransferred(address indexed oldPauser, address indexed newPauser)",
  "event Upgraded(address indexed implementation)",
  "event SetWormholePeer(uint16 chainId, bytes32 peerContract)",
];
