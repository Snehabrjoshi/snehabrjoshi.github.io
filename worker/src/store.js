// An upstream failure never replaces good data. Record: { data, updatedAt,
// quality ('full' | 'partial'), stale, checkedAt, error? }.

export const KEYS = { reading: 'data:reading', playlist: 'data:playlist' };

// Older than two cron intervals counts as stale even without a recorded failure.
const MAX_AGE_MS = 13 * 60 * 60 * 1000;

export async function readRecord(env, name) {
  try {
    return await env.CACHE.get(KEYS[name], 'json');
  } catch (error) {
    console.error(`[store] ${name}: unreadable KV value (${error.message})`);
    return null;
  }
}

export function present(record, now = Date.now()) {
  const old = now - Date.parse(record.updatedAt) > MAX_AGE_MS;
  return { ...record.data, updatedAt: record.updatedAt, stale: Boolean(record.stale || old) };
}

export async function refresh(env, name, load, now = () => new Date()) {
  const previous = await readRecord(env, name);
  const checkedAt = now().toISOString();
  let result;
  try {
    result = await load();
  } catch (error) {
    console.error(`[${name}] refresh failed: ${error.message}`);
    if (!previous) throw error;
    // Keep the last good data; only record that it is now stale.
    const record = { ...previous, stale: true, checkedAt, error: error.message };
    await env.CACHE.put(KEYS[name], JSON.stringify(record));
    return record;
  }
  const quality = result.quality ?? 'full';
  if (quality === 'partial' && previous?.quality === 'full') {
    console.warn(`[${name}] only fallback data available; keeping the last full data`);
    const record = { ...previous, stale: true, checkedAt, error: result.reason ?? 'fallback' };
    await env.CACHE.put(KEYS[name], JSON.stringify(record));
    return record;
  }
  const record = {
    data: result.data,
    updatedAt: checkedAt,
    quality,
    stale: false,
    checkedAt,
  };
  await env.CACHE.put(KEYS[name], JSON.stringify(record));
  return record;
}
