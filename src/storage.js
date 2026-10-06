import { validateSave } from './engine.js';
export const SAVE_KEY = 'sino-negro-save-v1',
  BACKUP_KEY = 'sino-negro-backup-v1';
function hash(text) {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}
export function encode(state) {
  const payload = JSON.stringify(state);
  return JSON.stringify({ format: 'sino-negro', schema: 1, checksum: hash(payload), payload });
}
export function decode(raw) {
  const v = JSON.parse(raw);
  if (
    v.format !== 'sino-negro' ||
    v.schema !== 1 ||
    typeof v.payload !== 'string' ||
    hash(v.payload) !== v.checksum
  )
    throw new Error('Arquivo de save inválido ou incompleto.');
  const s = JSON.parse(v.payload);
  if (!validateSave(s)) throw new Error('Este save não é compatível ou está danificado.');
  return s;
}
export function load(storage = globalThis.localStorage) {
  let failure = false;
  for (const key of [SAVE_KEY, BACKUP_KEY])
    try {
      const raw = storage.getItem(key);
      if (raw) {
        return {
          state: decode(raw),
          recovered: key === BACKUP_KEY,
          error: failure ? 'Save principal danificado; cópia recuperada.' : null,
        };
      }
    } catch {
      failure = true;
    }
  return {
    state: null,
    error: failure
      ? 'Não foi possível carregar o save. Importe uma cópia; o original não foi apagado.'
      : null,
  };
}
export function save(state, storage = globalThis.localStorage) {
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous) {
      try {
        decode(previous);
        storage.setItem(BACKUP_KEY, previous);
      } catch {}
    }
    state.lastSave = Date.now();
    storage.setItem(SAVE_KEY, encode(state));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        'O dispositivo não conseguiu gravar o progresso. Exporte seu save pelo menu antes de sair.',
    };
  }
}
