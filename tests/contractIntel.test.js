import {analyzeBytecode, stripMetadata, sanitizeLabel} from "../src/utils/contractIntel.js";
import {getAlerts} from "../src/utils/alerts.js";

const dispatcher = selectors => '0x6080604052' +
  selectors.map(s => `8063${s}1461004057`).join('') + '00';

describe("bytecode analysis", () => {
  it("detects eip-1167 minimal proxy and its implementation", () => {
    const impl = 'c0ffee254729296a45a3885639ac7e10f9d54979';
    const intel = analyzeBytecode(`0x363d3d373d3d3d363d73${impl}5af43d82803e903d91602b57fd5bf3`);
    expect(intel.minimalProxyImpl).toBe('0x' + impl);
    expect(intel.kind).toBe('EIP-1167 minimal proxy');
  });

  it("detects the solady clone variant", () => {
    const impl = 'c0ffee254729296a45a3885639ac7e10f9d54979';
    const intel = analyzeBytecode(`0x3d3d3d3d363d3d37363d73${impl}5af43d3d93803e602a57fd5bf3`);
    expect(intel.minimalProxyImpl).toBe('0x' + impl);
    expect(intel.kind).toBe('EIP-1167 minimal proxy');
  });

  it("extracts dispatcher selectors and classifies erc20", () => {
    const intel = analyzeBytecode(dispatcher(['a9059cbb', '095ea7b3', '70a08231', '18160ddd', '313ce567']));
    expect(intel.selectors).toEqual(expect.arrayContaining(['0xa9059cbb', '0x095ea7b3', '0x70a08231', '0x18160ddd']));
    expect(intel.names).toEqual(expect.arrayContaining(['transfer', 'approve', 'balanceOf', 'totalSupply', 'decimals']));
    expect(intel.kind).toBe('ERC20');
  });

  it("catches via-ir SUB/XOR dispatcher compares", () => {
    // unoptimized via-ir compiles the last compare as PUSH4 <sel> SUB PUSH2 <dst> JUMPI
    const intel = analyzeBytecode('0x6080604052' +
      '8063095ea7b31461004057' + '8063a9059cbb0361000e57' + '806318160ddd1861001257' + '00');
    expect(intel.selectors.sort()).toEqual(['0x095ea7b3', '0x18160ddd', '0xa9059cbb']);
  });

  it("ignores a distant selector cluster from embedded child code", () => {
    const intel = analyzeBytecode('0x' + '8063a9059cbb1461004057' + '00'.repeat(300) +
      '8063deadbeef1461004057' + '00');
    expect(intel.selectors).toEqual(['0xa9059cbb']);
  });

  it("classifies erc4626 vault", () => {
    const intel = analyzeBytecode(dispatcher(['6e553f65', 'ba087652', '38d52e0f', '70a08231']));
    expect(intel.kind).toBe('ERC4626 vault');
  });

  it("flags risky opcodes", () => {
    const intel = analyzeBytecode('0x6080604052f4f5f0ff00');
    expect(intel.flags.sort()).toEqual(['create', 'create2', 'delegatecall', 'selfdestruct']);
  });

  it("does not misread push immediates as opcodes", () => {
    // PUSH2 0xfff4, PUSH20 of 0xff bytes — data, not SELFDESTRUCT/DELEGATECALL
    const intel = analyzeBytecode('0x61fff473' + 'ff'.repeat(20) + '00');
    expect(intel.flags).toEqual([]);
  });

  it("strips cbor metadata so hash bytes are not flagged", () => {
    const meta = 'a2' + 'ff'.repeat(10); // 11 bytes
    const intel = analyzeBytecode('0x608060405200' + meta + '000b');
    expect(intel.flags).toEqual([]);
    const kept = stripMetadata(Buffer.from('608060405200ff', 'hex'));
    expect(kept.length).toBe(7); // no plausible metadata → untouched
  });

  it("cuts at embedded child metadata, not just the trailing block", () => {
    // child cbor (ipfs marker + random hash containing 0xff/0xf4) sits mid-buffer
    const intel = analyzeBytecode('0x608060405200' + 'a264697066735822' + 'fff4'.repeat(16) + '6080604052');
    expect(intel.flags).toEqual([]);
  });

  it("survives empty and non-contract input", () => {
    expect(analyzeBytecode('0x').size).toBe(0);
    expect(analyzeBytecode(undefined).size).toBe(0);
  });

  it("sanitizes deployer-controlled token labels", () => {
    expect(sanitizeLabel('`@everyone`\nrug')).toBe('everyonerug');
    expect(sanitizeLabel('x'.repeat(100)).length).toBe(48);
    expect(sanitizeLabel('```')).toBe(null);
    expect(sanitizeLabel(null)).toBe(null);
  });
});

describe("deployment alert message", () => {
  it("renders one line per known fact", () => {
    const lines = getAlerts().describeDeployment({
      code: {size: 3214, kind: 'ERC20', flags: ['delegatecall'], minimalProxyImpl: null,
        selectors: ['0xa9059cbb', '0x095ea7b3', '0xdeadbeef'], names: ['transfer', 'approve']},
      probe: {name: 'Token X', symbol: 'TKX', decimals: 18, supply: 1000000, owner: '0x' + '11'.repeat(20)},
      deployer: '0x' + '22'.repeat(20),
      deployerIntel: {txCount: 42, bound: true},
      factory: '0x' + '33'.repeat(20),
      factoryKind: 'ERC4626 vault',
      txHash: '0x' + '44'.repeat(32),
    });
    expect(lines).toEqual([
      'ERC20 — 3 214 B, fns: transfer, approve +1 more',
      'token "Token X" (TKX, 18 dec, supply 1 000 000)',
      `owner \`0x${'11'.repeat(20)}\``,
      `deployer \`0x${'22'.repeat(20)}\` — 42 txs, bound substrate account`,
      `via \`0x${'33'.repeat(20)}\` (ERC4626 vault)`,
      '⚠️ opcodes: delegatecall',
      `tx \`0x${'44'.repeat(32)}\``,
    ]);
  });

  it("degrades to the bare minimum when enrichment is empty", () => {
    expect(getAlerts().describeDeployment({})).toEqual(['top-level deploy']);
  });

  it("renders exact supply strings without float artifacts", () => {
    const line = supply => getAlerts().describeDeployment({
      probe: {symbol: 'X', supply}})[0];
    expect(line('123456789012345678901.0')).toContain('supply 123 456 789 012 345 678 901');
    expect(line('0.000000000000000001')).toContain('supply 0.000000000000000001');
    expect(line('0.0')).toContain('supply 0');
  });

  it("says nothing about binding when the probe failed", () => {
    const [line] = getAlerts().describeDeployment({
      deployer: '0xabc', deployerIntel: {txCount: null, bound: null}});
    expect(line).toBe('deployer `0xabc`');
  });

  it("shows the beacon even when its implementation could not be resolved", () => {
    const lines = getAlerts().describeDeployment({
      code: {size: 200, kind: null, flags: [], selectors: [], names: [], minimalProxyImpl: null},
      probe: {proxy: 'EIP-1967 beacon', beacon: '0x' + '55'.repeat(20), impl: null}});
    expect(lines[0]).toBe('EIP-1967 beacon proxy — 200 B');
    expect(lines[1]).toBe(`beacon \`0x${'55'.repeat(20)}\``);
  });

  it("counts hidden functions from what was actually shown", () => {
    const lines = getAlerts().describeDeployment({
      code: {size: 100, kind: null, flags: [], minimalProxyImpl: null,
        selectors: Array.from({length: 12}, (_, i) => `0x0000000${i.toString(16)}`),
        names: ['transfer', 'transfer', 'approve']}});
    expect(lines[0]).toBe('contract — 100 B, fns: transfer, approve +10 more');
  });
});
