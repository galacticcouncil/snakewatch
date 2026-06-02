import {Events} from "../src/events.js";
import {disconnect, initApi} from "../src/api.js";

describe("CircuitBreaker Events", () => {
  let events;

  beforeAll(async () => {
    console.warn = () => {};
    await initApi("wss://rpc.hydradx.cloud");
  });

  beforeEach(() => {
    events = new Events();
  });

  it('should find circuitBreaker.AssetLockdown event', async () => {
    events.on('circuitBreaker', 'AssetLockdown', ({event: {section, method, data}}) => {
      expect(section).toBe('circuitBreaker');
      expect(method).toBe('AssetLockdown');
      expect(data.assetId.toNumber()).toBe(19);
      expect(data.until.toNumber()).toBe(9619501);
      console.log(`Asset ${data.assetId} locked until block ${data.until}`);
    });
    const count = await events.emitFromBlock(9605101);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => {
    await disconnect();
  });
});
