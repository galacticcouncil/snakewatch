import {loadEvents, Events} from "../src/events.js";
import {disconnect, initApi} from "../src/api.js";

describe("Events", () => {
  let preloadedEvents;
  let events;

  beforeAll(async () => {
    console.warn = () => {};
    await initApi("wss://rpc-01.basilisk-rococo.hydradx.io");
    preloadedEvents = await loadEvents(450747);
    expect(preloadedEvents).toBeDefined();
  });

  beforeEach(() => {
    events = new Events();
  });

  it('on should find balances.Withdraw event', async () => {
    events.on('balances', 'Withdraw', ({event: {section, method}}) => expect(section).toBe('balances') && expect(method).toBe('Withdraw'));
    expect(await events.emit(preloadedEvents)).toBe(1);
  });

  it('onSection should find xyk', async () => {
    events.onSection('xyk', ({event: {section}}) => expect(section).toBe('xyk'));
    expect(await events.emit(preloadedEvents)).toBe(1);
  });

  it('onData should find account', async () => {
    const account = 'bXhWRGcGhADH5ZWBJwo5c3G6kLEGVv3gyWfrDxuYqQGS75X94';
    events.onFilter(
      'balances',
      'Withdraw',
      ({event}) => event.data.who.toString() === account,
      ({event: {data: {who}}}) => expect(who.toString()).toBe(account)
    );
    expect(await events.emit(preloadedEvents)).toBe(1);
  });

  afterAll(async () => {
    await disconnect();
  });
});
