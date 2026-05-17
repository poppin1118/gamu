import { Btn } from '../engine/Input.js';

export const MSG = Object.freeze({
  HELLO: 1,
  START: 2,
  INPUT: 3,
  SNAPSHOT: 4,
  PING: 5,
  PONG: 6,
  BYE: 7,
});

export const ROOM_PREFIX = 'gamu-';

const INPUT_BITS = [
  Btn.LEFT,
  Btn.RIGHT,
  Btn.UP,
  Btn.DOWN,
  Btn.A,
  Btn.B,
  Btn.START,
  Btn.SELECT,
];

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

/**
 * 將 InputState 壓成單 byte bitfield，降低每 tick 傳輸量。
 *
 * @param {InputState} input_state - 要封包化的輸入狀態。
 * @returns {number} 0-255 的輸入 bitfield。
 * @depends Btn
 */
export function packInput(input_state) {
  let input_bits = 0;
  INPUT_BITS.forEach((button_name, bit_index) => {
    if (input_state.isDown(button_name)) input_bits |= (1 << bit_index);
  });
  return input_bits;
}

/**
 * 將輸入 bitfield 套用到 InputState，並保留 wasPressed/wasReleased 邊緣。
 *
 * @param {InputState} input_state - 要被更新的輸入狀態。
 * @param {number} input_bits - 0-255 的輸入 bitfield。
 * @returns {void}
 * @depends Btn, InputState.set
 */
export function applyInputBits(input_state, input_bits) {
  INPUT_BITS.forEach((button_name, bit_index) => {
    input_state.set(button_name, (input_bits & (1 << bit_index)) !== 0);
  });
}

/**
 * 產生 PeerJS 房間代碼；使用 Web Crypto，避免影響 deterministic gameplay rng。
 *
 * @param {Crypto} crypto_source - 瀏覽器 crypto 物件。
 * @returns {string} 完整房間代碼，例如 gamu-A7K9QX。
 * @depends ROOM_PREFIX
 */
export function generateRoomCode(crypto_source = globalThis.crypto) {
  const random_bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto_source.getRandomValues(random_bytes);
  let room_suffix = '';
  for (const random_byte of random_bytes) {
    room_suffix += ROOM_ALPHABET[random_byte % ROOM_ALPHABET.length];
  }
  return `${ROOM_PREFIX}${room_suffix}`;
}

/**
 * 正規化玩家輸入的房間代碼，接受含或不含 gamu- 前綴的格式。
 *
 * @param {string} raw_code - 玩家輸入的房間代碼。
 * @returns {string} 正規化後的完整 room id。
 * @depends ROOM_PREFIX
 */
export function normalizeRoomCode(raw_code) {
  const compact_code = String(raw_code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!compact_code) return '';
  if (compact_code.toLowerCase().startsWith(ROOM_PREFIX)) {
    return `${ROOM_PREFIX}${compact_code.slice(ROOM_PREFIX.length).toUpperCase()}`;
  }
  return `${ROOM_PREFIX}${compact_code}`;
}
