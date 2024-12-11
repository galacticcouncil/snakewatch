import {Client, GatewayIntentBits} from 'discord.js';
import markdownToAnsi from 'markdown-to-ansi'
import memoize from "memoizee";

let _client = null;
let _channel = null;
const toAnsi = markdownToAnsi();

export function initDiscord(token, channel) {
  const client = new Client({intents: [GatewayIntentBits.Guilds]});
  return new Promise(resolve => {
    client.once('ready', () => {
      console.log('discord ready');
      _client = client;
      _channel = channel;
      resolve()
    });
    client.login(token);
  });
}

export function client() {
  if (!_client) {
    throw new Error('discord not initialized');
  }
  return _client;
}

export function broadcast(message) {
  console.log(toAnsi(message));
  if (_client) {
    const channel = client().channels.cache.get(_channel);
    if (channel) {
      channel.send(message);
    } else {
      console.error(new Error(`discord channel ${_channel} not connected`));
      process.exit(421);
    }
  }
}

export const broadcastOnce = memoize(broadcast);
