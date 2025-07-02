import {api} from './api.js';
import ethers from "ethers";
import {delay, timeout} from "./config.js";

export class Events {
  listeners = [];

  on(section, method, addedCallback) {
    this.listeners.push({method, section, addedCallback});
    return this;
  }

  onFilter(section, method, filterPredicate, addedCallback) {
    this.listeners.push({method, section, filterPredicate, addedCallback});
    return this;
  }

  onSection(section, addedCallback) {
    this.listeners.push({section, addedCallback});
    return this;
  }

  onLog(name, abi, callback, filter = () => true) {
    const iface = new ethers.utils.Interface(abi);
    const filterPredicate = (payload) => {
      try {
        const {event: {data}} = payload;
        payload.log = iface.parseLog(data.log.toHuman());
        return payload.log.name === name && filter(payload);
      } catch (e) {
        return false;
      }
    }
    const addedCallback = payload => {
      payload.log = iface.parseLog(payload.event.data.log.toHuman());
      return callback(payload);
    };
    this.listeners.push({section: 'evm', method: 'Log', filterPredicate, addedCallback});
    return this;
  }

  addHandler(handler) {
    handler(this);
  }

  startWatching() {
    let watchdogTimer;

    const resetWatchdog = () => {
      clearTimeout(watchdogTimer);

      watchdogTimer = setTimeout(() => {
        throw new Error(`no block received for ${timeout} seconds`);
      }, timeout * 1000);
    };

    api().query.system.number(head => {
      resetWatchdog();
      const block = head.toNumber() - delay;
      this.emitFromBlock(block);
    });
  }

  async emit(events) {
    const listeners = this.listeners;
    const callbacks = events.flatMap(e => listeners
        .filter(({method, section, filterPredicate}) =>
          (method ? e.event.method === method : true)
          && (filterPredicate ? filterPredicate(e) : true)
          && (section ? e.event.section === section : true))
        .map(({addedCallback}) => [this.useHandledCallback(addedCallback), e])
    );
    for (const [callback, event] of callbacks) {
      await callback(event);
    }
    return callbacks.length;
  }

  async emitFromBlock(blocknumber) {
    console.log(`block ${blocknumber}`);
    return loadEvents(blocknumber)
      .then(events => this.emit(events))
      .catch(err => console.error(`failed to load ${blocknumber}:`, err.toString()));
  }

  useHandledCallback(callback) {
    return async (...args) => {
      let result;
      try {
        result = await callback(...args);
      } catch (e) {
        console.log(`processing of the event failed: ${e}`, args, e);
      }
      return result;
    };
  }
}

export const loadEvents = async blockNumber => api().rpc.chain.getBlockHash(blockNumber)
  .then(hash => api().query.system.events.at(hash))
  .then(events => processEvents(events, blockNumber));

export const processEvents = (events, blockNumber) => events.map(event => {
  event.blockNumber = blockNumber;
  event.siblings = events
    .filter(({phase}) => (phase.isInitialization && event.phase.isInitialization)
      || phase.isApplyExtrinsic
      && event.phase.isApplyExtrinsic
      && phase.asApplyExtrinsic.eq(event.phase.asApplyExtrinsic))
    .map(({event}) => event);
  return event;
});
