import {decodeAddress} from '@polkadot/util-crypto';

const toHex = address => {
  try {
    return address.toHex ? address.toHex() : '0x' + Buffer.from(decodeAddress(address)).toString('hex');
  } catch (e) {
    return null;
  }
};

export const isSameAccount = (addr1, addr2) => {
  const hex1 = toHex(addr1);
  const hex2 = toHex(addr2);
  return hex1 && hex2 && hex1 === hex2;
};

export const emojify = address => {
  const degenAddress = Object.keys(degens).find(key => isSameAccount(key, address));
  return degenAddress ? degens[degenAddress] : emojis[(Number(toHex(address)) / 2) % emojis.length];
};

const emojis = ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿', '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊', '🦅', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐬', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🐌', '🦋', '🐛', '🐜', '🐝', '🐞', '🦗', '🕷', '🦂', '🦟', '🦠', '💐', '🌸', '💮', '🏵', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘', '🍀', '🍁', '🍂', '🍃', '🍄',];

/*
 * To get ID of custom emoji in discord; type "\" then the name of your emoji
 *
 * For example, type
 * \:cheems:
 * and it will return
 * <:cheems:989553853785587723>
 */
const degens = {
  '7MsLP8yfa4dzCAyBX5jxDk2UR7DEATQYNcfpMxgnRDWx6Xin': '<:buffdoge:989553819539103764>',
  '7Hsq5RH9xUtPWFZMGXtoVWNd4CEjpJWsidf7bcGwNwdxp9Ha': '🍺',
  '7NYZSi7PtWM6QP7p6kzYsN92gxNjikApsvstz6H9y8tjbVrZ': '<:thuglife:989554541357834261>',
  '7Ljigfve9PdRqvSjiRGUjVf37rbX3n89ZmaitD2hQQhtLBMN': '<:heimdall:1005035405864869939>',
  '7KZST3yphBsPdRCjUNjP1yTx8RNJaiecHsRyYTgaGHdpG1ZJ': '<:kraken:1068218238074376193>',
  '7KejvRw4GZvVjFQEDefAsBRd9iaTjVeUWczB44Mgu8Bue8JW': '<:Parakeet:1074721851550466219>',
  '7LU16Y84xGTMHxbKp2DDmmeSks8Zitzf1prf2P226Fs1FrWA': '<:Charizard:1074723144209809519>',
  '7HcZDdrcvbjL8CeqK7J8oypnBMCfrHPTcpH6QvM2xXbRDyZt': '<:bulbasaur:1064486523715719208>',
  '7MAvv6YQeXULbpNAKWceqA6voTLoioDzm71ggvWzstyPDepm': '<:sir:1069817913088946276>',
  '7JnnrDVoGrXA68TuQMVasG8TD8D2iagjmBA3bSEYyBHphbvy': '🌴',
  '7LxFHadXE2giKvJsi7ybcvjriXjazAtGwBE1ptnUxLWDv4uy': '🍄',
  '7L53bUTBopuwFt3mKUfmkzgGLayYa1Yvn1hAg9v5UMrQzTfh': '🏦',
  '7LGWvFudYrVdJYxG8ekhFSpgzfN4e7BbTzTKpi3wAr1BPrsB': '<:Dragonite:1074723182944198666>',
  '7Nws2zozshPbEmKXRaFch2H21PPT5jT76mckZGRd1iokfAUQ': '<:Venusaur:1074723145518432268>',
  '7L1jebaeGNykbey5gZhZCD4PLVLtjPm5RKpKXRYV4NXsF6TM': '🦍',
  '7KQx4f7yU3hqZHfvDVnSfe6mpgAT8Pxyr67LXHV6nsbZo3Tm': '<:polkadot:1064520790978080818>',
  '7LcF8b5GSvajXkSChhoMFcGDxF9Yn9unRDceZj1Q6NYox8HY': '<:polkadot:1064520790978080818>',
  '7KCp4eenFS4CowF9SpQE5BBCj5MtoBA3K811tNyRmhLfH1aV': '<:polkadot:1064520790978080818>',
  '7N4oFqXKgeTXo6CMSY9BVZdHP5J3RhQXY77Fe7qmQwjcxa1w': '<:polkadot:1064520790978080818>',
  '7LCt6dFmtiRrwZv2YyEgQWW3GxsGX3Krmgzv9Xj7GQ9tG2j8': '<:moonbeam:1390048945023094966>',
  '7KuHrDdWdFs53fRPpzZXngS6wdymqAQ398VYUuyYkQwXpE4j': '<:polkadot:1064520790978080818>',
  '7KATdGae91uodYHAhxuA7Re7ijGTDAFFa9ykVhUhJf9kEAR5': '<:HOLLAR:1419786409664970834>',
};
