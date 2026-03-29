import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../db.js', async () => {
  const { createTestDb } = await import('../test-setup.js');
  return { default: createTestDb() };
});

import request from 'supertest';
import app from '../app.js';
import db from '../db.js';

let stationId: string;

const songEntry = {
  type: 'song',
  canonical_id: 'c1',
  artist: 'SZA',
  title: 'Kill Bill',
  duration_ms: 214000,
};

const segmentEntry = {
  type: 'segment',
  segment_id: 'SEG-TR-00001',
  audio_url: '/audio/seg-tr-00001.wav',
  duration_ms: 8000,
};

beforeEach(async () => {
  db.exec('DELETE FROM timeline_history');
  db.exec('DELETE FROM timelines');
  db.exec('DELETE FROM station_tracks');
  db.exec('DELETE FROM segments');
  db.exec('DELETE FROM stations');

  const res = await request(app).post('/api/stations').send({ name: 'Test Station' });
  stationId = res.body.station_id;
});

describe('POST /api/timelines', () => {
  it('creates a timeline and returns 201', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [segmentEntry, songEntry, segmentEntry],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.station_id).toBe(stationId);
    expect(res.body.created_at).toBeDefined();
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.entries[0].type).toBe('segment');
    expect(res.body.entries[1].type).toBe('song');
  });

  it('inserts a record into timeline_history', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [songEntry] });

    const history = db.prepare(
      'SELECT * FROM timeline_history WHERE timeline_id = ?'
    ).get(res.body.id) as { id: string; timeline_id: string; station_id: string };

    expect(history).toBeDefined();
    expect(history.timeline_id).toBe(res.body.id);
    expect(history.station_id).toBe(stationId);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({ station_id: 'nonexistent', entries: [songEntry] });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/station not found/i);
  });

  it('returns 400 when station_id is missing', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({ entries: [songEntry] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/station_id/i);
  });

  it('returns 400 when entries is empty', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entries/i);
  });

  it('returns 400 when entries is missing', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entries/i);
  });

  it('returns 400 for song entry missing canonical_id', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'song', artist: 'A', title: 'T', duration_ms: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/canonical_id/i);
  });

  it('returns 400 for song entry missing artist', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'song', canonical_id: 'c1', title: 'T', duration_ms: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/artist/i);
  });

  it('returns 400 for song entry missing title', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'song', canonical_id: 'c1', artist: 'A', duration_ms: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 for song entry with invalid duration_ms', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'song', canonical_id: 'c1', artist: 'A', title: 'T', duration_ms: -1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration_ms/i);
  });

  it('returns 400 for segment entry missing segment_id', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'segment', audio_url: '/a.wav', duration_ms: 5000 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/segment_id/i);
  });

  it('returns 400 for segment entry missing audio_url', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'segment', segment_id: 'SEG-1', duration_ms: 5000 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/audio_url/i);
  });

  it('returns 400 for entry with unknown type', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ type: 'ad', content: 'Buy stuff' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('returns 400 for entry with missing type', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ canonical_id: 'c1', artist: 'A', title: 'T', duration_ms: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('preserves optional isrc on song entries', async () => {
    const res = await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [{ ...songEntry, isrc: 'USRC12345678' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.entries[0].isrc).toBe('USRC12345678');
  });
});

describe('GET /api/stations/:id/timeline', () => {
  it('returns the most recent timeline', async () => {
    await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [songEntry] });

    // Backdate the first timeline so the second is newer
    db.prepare("UPDATE timelines SET created_at = datetime('now', '-1 minute') WHERE station_id = ?").run(stationId);

    const second = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [segmentEntry, songEntry] });

    const res = await request(app).get(`/api/stations/${stationId}/timeline`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(second.body.id);
    expect(res.body.entries).toHaveLength(2);
  });

  it('returns 404 when station has no timelines', async () => {
    const res = await request(app).get(`/api/stations/${stationId}/timeline`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no timeline/i);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app).get('/api/stations/nonexistent/timeline');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/station not found/i);
  });
});

describe('GET /api/stations/:id/timeline/history', () => {
  it('returns timeline history ordered by created_at desc', async () => {
    await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [songEntry] });

    db.prepare("UPDATE timelines SET created_at = datetime('now', '-1 minute') WHERE station_id = ?").run(stationId);

    await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [segmentEntry, songEntry, segmentEntry] });

    const res = await request(app).get(`/api/stations/${stationId}/timeline/history`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Most recent first
    expect(res.body[0].entry_count).toBe(3);
    expect(res.body[1].entry_count).toBe(1);
  });

  it('returns entry_count and total_duration_ms', async () => {
    await request(app)
      .post('/api/timelines')
      .send({
        station_id: stationId,
        entries: [
          { ...songEntry, duration_ms: 200000 },
          { ...segmentEntry, duration_ms: 8000 },
        ],
      });

    const res = await request(app).get(`/api/stations/${stationId}/timeline/history`);

    expect(res.body[0].entry_count).toBe(2);
    expect(res.body[0].total_duration_ms).toBe(208000);
    expect(res.body[0].id).toBeDefined();
    expect(res.body[0].created_at).toBeDefined();
  });

  it('supports limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/timelines')
        .send({ station_id: stationId, entries: [songEntry] });
    }

    const page1 = await request(app).get(`/api/stations/${stationId}/timeline/history?limit=2&offset=0`);
    expect(page1.body).toHaveLength(2);

    const page2 = await request(app).get(`/api/stations/${stationId}/timeline/history?limit=2&offset=2`);
    expect(page2.body).toHaveLength(2);

    const page3 = await request(app).get(`/api/stations/${stationId}/timeline/history?limit=2&offset=4`);
    expect(page3.body).toHaveLength(1);
  });

  it('returns empty array when no timelines exist', async () => {
    const res = await request(app).get(`/api/stations/${stationId}/timeline/history`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app).get('/api/stations/nonexistent/timeline/history');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/station not found/i);
  });
});

describe('GET /api/timelines/:id', () => {
  it('returns a specific timeline', async () => {
    const created = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [segmentEntry, songEntry] });

    const res = await request(app).get(`/api/timelines/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.station_id).toBe(stationId);
    expect(res.body.entries).toHaveLength(2);
  });

  it('returns 404 for nonexistent timeline', async () => {
    const res = await request(app).get('/api/timelines/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('cascade delete', () => {
  it('deletes timelines when station is deleted', async () => {
    const created = await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [songEntry] });

    await request(app).delete(`/api/stations/${stationId}`);

    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ?').get(created.body.id);
    expect(timeline).toBeUndefined();
  });

  it('deletes timeline_history when station is deleted', async () => {
    await request(app)
      .post('/api/timelines')
      .send({ station_id: stationId, entries: [songEntry] });

    await request(app).delete(`/api/stations/${stationId}`);

    const history = db.prepare('SELECT * FROM timeline_history WHERE station_id = ?').all(stationId);
    expect(history).toHaveLength(0);
  });
});
