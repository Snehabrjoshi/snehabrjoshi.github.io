import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refresh, present, KEYS } from '../src/store.js';
import { memoryKV } from './helpers.js';

const at = (iso) => () => new Date(iso);
const good = { data: { lastRead: { title: 'Kept' } }, quality: 'full' };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('refresh', () => {
  it('stores a successful result', async () => {
    const env = { CACHE: memoryKV() };
    const record = await refresh(env, 'reading', async () => good, at('2026-11-22T00:00:00Z'));
    expect(record).toMatchObject({
      data: good.data,
      updatedAt: '2026-11-22T00:00:00.000Z',
      stale: false,
    });
    expect(await env.CACHE.get(KEYS.reading, 'json')).toEqual(record);
  });

  it('upstream fails → keeps the last good data and marks it stale', async () => {
    const env = { CACHE: memoryKV() };
    await refresh(env, 'reading', async () => good, at('2026-11-22T00:00:00Z'));
    const record = await refresh(
      env,
      'reading',
      async () => {
        throw new Error('Goodreads shelf "read": HTTP 503');
      },
      at('2026-11-22T06:00:00Z'),
    );
    expect(record.data).toEqual(good.data);
    expect(record.updatedAt).toBe('2026-11-22T00:00:00.000Z');
    expect(record.stale).toBe(true);
    expect(record.checkedAt).toBe('2026-11-22T06:00:00.000Z');
    expect((await env.CACHE.get(KEYS.reading, 'json')).data).toEqual(good.data);
    expect(present(record)).toMatchObject({
      lastRead: { title: 'Kept' },
      stale: true,
      updatedAt: '2026-11-22T00:00:00.000Z',
    });
  });

  it('the next success clears stale', async () => {
    const env = { CACHE: memoryKV() };
    await refresh(env, 'reading', async () => good, at('2026-11-22T00:00:00Z'));
    await refresh(
      env,
      'reading',
      async () => Promise.reject(new Error('down')),
      at('2026-11-22T06:00:00Z'),
    );
    const record = await refresh(
      env,
      'reading',
      async () => ({ data: { lastRead: null }, quality: 'full' }),
      at('2026-11-22T12:00:00Z'),
    );
    expect(record.stale).toBe(false);
    expect(record.data).toEqual({ lastRead: null });
  });

  it('a partial fallback never replaces full data', async () => {
    const env = { CACHE: memoryKV() };
    await refresh(
      env,
      'playlist',
      async () => ({ data: { name: 'Full', tracks: [1] }, quality: 'full' }),
      at('2026-11-22T00:00:00Z'),
    );
    const record = await refresh(
      env,
      'playlist',
      async () => ({ data: { name: 'Full', tracks: [] }, quality: 'partial', reason: 'HTTP 403' }),
      at('2026-11-22T06:00:00Z'),
    );
    expect(record.data.tracks).toEqual([1]);
    expect(record.stale).toBe(true);
  });

  it('a partial fallback is stored when there is nothing better', async () => {
    const env = { CACHE: memoryKV() };
    const record = await refresh(env, 'playlist', async () => ({
      data: { tracks: [] },
      quality: 'partial',
    }));
    expect(record.quality).toBe('partial');
    expect(record.stale).toBe(false);
  });

  it('throws when the upstream fails and nothing is stored', async () => {
    const env = { CACHE: memoryKV() };
    await expect(
      refresh(env, 'reading', async () => Promise.reject(new Error('down'))),
    ).rejects.toThrow('down');
    expect(env.CACHE.store.size).toBe(0);
  });
});

describe('present', () => {
  it('counts data older than two cron intervals as stale', () => {
    const record = { data: { a: 1 }, updatedAt: '2026-11-22T00:00:00.000Z', stale: false };
    expect(present(record, Date.parse('2026-11-22T12:00:00Z')).stale).toBe(false);
    expect(present(record, Date.parse('2026-11-22T14:00:00Z')).stale).toBe(true);
  });
});
