import {api} from './api.js';

export class Events {
  listeners = [];

  on(section, method, addedCallback) {
    this.listeners.push({method, section, addedCallback});
    return this;
  }

  onData(section, method, dataPredicate, addedCallback) {
    this.listeners.push({method, section, dataPredicate, addedCallback});
    return this;
  }

  onSection(section, addedCallback) {
    this.listeners.push({section, addedCallback});
    return this;
  }

  addHandler(handler) {
    handler(this);
  }

  startWatching() {
    this.killWatcher = api().query.system.number(head => {
      console.log(`block ${head.toNumber()}`);
      this.emitFromBlock(head-1);
    });
  }

  stopWatching() {
    if (this.killWatcher) {
      this.killWatcher();
    }
  }

  async emit(events) {
    const listeners = this.listeners;
    return (await Promise.all(
      events.flatMap(e => listeners
        .filter(({method, section, dataPredicate}) =>
          (method ? e.event.method === method : true)
          && (dataPredicate ? dataPredicate(e.event.data) : true)
          && (section ? e.event.section === section : true))
        .map(({addedCallback}) => this.useHandledCallback(addedCallback)(e)))
    )).length;
  }

  async emitFromBlock(blocknumber) {
    return loadEvents(blocknumber).then(events => this.emit(events));
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
  .then(processEvents);

export const processEvents = events => events.map(event => ({
  siblings: events
    .filter(({phase}) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(event.phase.asApplyExtrinsic))
    .map(({event}) => event),
  ...event
}));
