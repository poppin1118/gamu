const _games = new Map();

export function registerGame(mod) {
  if (!mod || !mod.id) throw new Error('registerGame: missing id');
  if (typeof mod.factory !== 'function') throw new Error(`registerGame(${mod.id}): factory must be a function`);
  _games.set(mod.id, mod);
}

export function listGames() {
  return Array.from(_games.values());
}

export function getGame(id) {
  return _games.get(id);
}
