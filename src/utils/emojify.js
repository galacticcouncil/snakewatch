export const emojify = address => degens[address] || emojis[Number(address.toHex()) % emojis.length];
const emojis = ['🌚', '🌝', '<:cheems:989553853785587723>', '🐁', '🐂', '🐃', '🐄', '🐅', '🐆', '🐇', '🐈', '🐉', '🐊', '🐋', '🐌', '🐎', '🐏', '🐐', '🐑', '🐓', '🐕', '🐖', '🐗', '🐘', '🐙', '🐛', '🐝', '🐞', '🐡', '🐢', '🐨', '🐭', '🐮', '🐯', '🐰', '🐲', '🐴', '🐵', '🐶', '🐷', '🐸', '🐹', '🐺', '🐻', '🐼', '🐿', '👹', '👺', '👻', '👼', '👽', '👾', '👿', '💀', '🙉', '🚁', '🚜', '🚶', '🛩', '🛳', '🤖', '🦀', '🦁', '🦂', '🦃', '🦄'];

/*
 * To get ID of custom emoji in discord; type "\" then the name of your emoji
 *
 * For example, type
 * \:cheems:
 * and it will return
 * <:cheems:989553853785587723>
 */
const degens = {
  '7M5sSEFabSS3DmYmLhhj5P7C22CrPUqcpmgVcfL5agewjB27': '<:buffdoge:989553819539103764>',
};