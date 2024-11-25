import {api} from './api.js';
import ethers from "ethers";

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

  onLog(name, abi, callback) {
    const iface = new ethers.utils.Interface(abi);
    const filterPredicate = ({event: {data}}) => {
      try {
        return iface.parseLog(data.log.toHuman()).name === name;
      } catch (e) {
        return false;
      }
    }
    const addedCallback = payload => callback({...payload, log: iface.parseLog(payload.event.data.log.toHuman())});
    this.listeners.push({section: 'evm', method: 'Log', filterPredicate, addedCallback});
    return this;
  }

  addHandler(handler) {
    handler(this);
  }

  startWatching() {
    this.killWatcher = api().query.system.number(head => {
      const block = head.toNumber() - 1;
      this.emitFromBlock(block);
    });
  }

  stopWatching() {
    if (this.killWatcher) {
      this.killWatcher();
    }
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

export const processEvents = (events, blockNumber) => events.map(event => ({
  blockNumber,
  siblings: events
    .filter(({phase}) => (phase.isInitialization && event.phase.isInitialization)
      || phase.isApplyExtrinsic
      && event.phase.isApplyExtrinsic
      && phase.asApplyExtrinsic.eq(event.phase.asApplyExtrinsic))
    .map(({event}) => event),
  ...event
}));
