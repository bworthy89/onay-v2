import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../db.js', async () => {
  const { createTestDb } = await import('../test-setup.js');
  return { default: createTestDb() };
});

import request from 'supertest';
import app from '../app.js';
import db from '../db.js';

beforeEach(() => {
  db.exec('DELETE FROM timeline_history');
  db.exec('DELETE FROM timelines');
  db.exec('DELETE FROM station_tracks');
  db.exec('DELETE FROM segments');
  db.exec('DELETE FROM stations');
});

describe('POST /api/stations', () => {
  it('creates a station and returns 201', async () => {
    const res = await request(app)
      .post('/api/stations')
      .send({
        name: 'Late Night Vibes',
        description: 'Chill late-night hip-hop',
        genre_tags: ['hip-hop', 'r&b'],
        mood_tags: ['chill', 'late-night'],
      });

    expect(res.status).toBe(201);
    expect(res.body.station_id).toBeDefined();
    expect(res.body.name).toBe('Late Night Vibes');
    expect(res.body.description).toBe('Chill late-night hip-hop');
    expect(res.body.genre_tags).toEqual(['hip-hop', 'r&b']);
    expect(res.body.mood_tags).toEqual(['chill', 'late-night']);
    expect(res.body.is_published).toBe(false);
    expect(res.body.created_at).toBeDefined();
  });

  it('creates a station with only name', async () => {
    const res = await request(app)
      .post('/api/stations')
      .send({ name: 'Minimal Station' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Minimal Station');
    expect(res.body.genre_tags).toEqual([]);
    expect(res.body.mood_tags).toEqual([]);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/stations')
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/stations')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/stations', () => {
  it('returns empty array when no stations exist', async () => {
    const res = await request(app).get('/api/stations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all stations', async () => {
    await request(app).post('/api/stations').send({ name: 'Station A' });
    await request(app).post('/api/stations').send({ name: 'Station B' });

    const res = await request(app).get('/api/stations');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by published=true', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'Draft' });
    await request(app)
      .put(`/api/stations/${created.body.station_id}`)
      .send({ is_published: true });

    await request(app).post('/api/stations').send({ name: 'Unpublished' });

    const res = await request(app).get('/api/stations?published=true');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Draft');
  });

  it('does not include tracklist in listing', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'Test' });

    const res = await request(app).get('/api/stations');

    expect(res.body[0].tracklist).toBeUndefined();
  });
});

describe('GET /api/stations/:id', () => {
  it('returns station with tracklist', async () => {
    const created = await request(app)
      .post('/api/stations')
      .send({ name: 'Hip-Hop Hits', genre_tags: ['hip-hop'] });

    await request(app)
      .post(`/api/stations/${created.body.station_id}/tracks`)
      .send({ canonical_id: 'c1', artist: 'Kendrick', title: 'HUMBLE.', duration_ms: 177000 });

    const res = await request(app).get(`/api/stations/${created.body.station_id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Hip-Hop Hits');
    expect(res.body.tracklist).toHaveLength(1);
    expect(res.body.tracklist[0].artist).toBe('Kendrick');
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app).get('/api/stations/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns empty tracklist when station has no tracks', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'Empty' });

    const res = await request(app).get(`/api/stations/${created.body.station_id}`);

    expect(res.body.tracklist).toEqual([]);
  });
});

describe('PUT /api/stations/:id', () => {
  it('updates station metadata', async () => {
    const created = await request(app)
      .post('/api/stations')
      .send({ name: 'Original', genre_tags: ['pop'] });

    const res = await request(app)
      .put(`/api/stations/${created.body.station_id}`)
      .send({ name: 'Updated', genre_tags: ['hip-hop', 'r&b'] });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.genre_tags).toEqual(['hip-hop', 'r&b']);
  });

  it('partially updates — leaves other fields intact', async () => {
    const created = await request(app)
      .post('/api/stations')
      .send({ name: 'Original', description: 'Keep this', genre_tags: ['jazz'] });

    const res = await request(app)
      .put(`/api/stations/${created.body.station_id}`)
      .send({ name: 'New Name' });

    expect(res.body.name).toBe('New Name');
    expect(res.body.description).toBe('Keep this');
    expect(res.body.genre_tags).toEqual(['jazz']);
  });

  it('updates is_published', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'Draft' });

    const res = await request(app)
      .put(`/api/stations/${created.body.station_id}`)
      .send({ is_published: true });

    expect(res.body.is_published).toBe(true);
  });

  it('updates updated_at timestamp', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'Timestamped' });

    // Backdate created_at so the update produces a different timestamp
    db.prepare("UPDATE stations SET created_at = datetime('now', '-1 minute') WHERE id = ?").run(created.body.station_id);

    const res = await request(app)
      .put(`/api/stations/${created.body.station_id}`)
      .send({ name: 'Updated' });

    const original = db.prepare('SELECT created_at FROM stations WHERE id = ?').get(created.body.station_id) as { created_at: string };
    expect(res.body.updated_at).not.toBe(original.created_at);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app)
      .put('/api/stations/nonexistent-id')
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/stations/:id', () => {
  it('deletes station and returns 204', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'To Delete' });

    const res = await request(app).delete(`/api/stations/${created.body.station_id}`);

    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/stations/${created.body.station_id}`);
    expect(check.status).toBe(404);
  });

  it('cascade deletes station_tracks', async () => {
    const created = await request(app).post('/api/stations').send({ name: 'With Tracks' });
    await request(app)
      .post(`/api/stations/${created.body.station_id}/tracks`)
      .send({ canonical_id: 'c1', artist: 'Artist', title: 'Song', duration_ms: 200000 });

    await request(app).delete(`/api/stations/${created.body.station_id}`);

    const tracks = db.prepare('SELECT * FROM station_tracks WHERE station_id = ?').all(created.body.station_id);
    expect(tracks).toHaveLength(0);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app).delete('/api/stations/nonexistent-id');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/stations/:id/tracks', () => {
  it('adds a track at the end of the list', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Tracks Test' });
    const stationId = station.body.station_id;

    const res = await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({
        canonical_id: 'c1',
        artist: 'SZA',
        title: 'Kill Bill',
        duration_ms: 214000,
        apple_music_id: 'am-123',
      });

    expect(res.status).toBe(201);
    expect(res.body.canonical_id).toBe('c1');
    expect(res.body.artist).toBe('SZA');
    expect(res.body.position).toBe(0);
    expect(res.body.apple_music_id).toBe('am-123');
  });

  it('auto-increments position', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Position Test' });
    const stationId = station.body.station_id;

    await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c1', artist: 'A', title: 'Song 1', duration_ms: 100000 });

    const res = await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c2', artist: 'B', title: 'Song 2', duration_ms: 100000 });

    expect(res.body.position).toBe(1);
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app)
      .post('/api/stations/nonexistent-id/tracks')
      .send({ canonical_id: 'c1', artist: 'A', title: 'T', duration_ms: 100000 });

    expect(res.status).toBe(404);
  });

  it('returns 400 for missing required fields', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Validation' });

    const res = await request(app)
      .post(`/api/stations/${station.body.station_id}/tracks`)
      .send({ canonical_id: 'c1' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/stations/:id/tracks', () => {
  it('replaces entire tracklist', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Replace Test' });
    const stationId = station.body.station_id;

    await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c1', artist: 'Old', title: 'Old Song', duration_ms: 100000 });

    const res = await request(app)
      .put(`/api/stations/${stationId}/tracks`)
      .send([
        { position: 0, canonical_id: 'c2', artist: 'New A', title: 'Song A', duration_ms: 200000 },
        { position: 1, canonical_id: 'c3', artist: 'New B', title: 'Song B', duration_ms: 300000 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].artist).toBe('New A');
    expect(res.body[1].artist).toBe('New B');
  });

  it('returns 404 for nonexistent station', async () => {
    const res = await request(app)
      .put('/api/stations/nonexistent-id/tracks')
      .send([]);

    expect(res.status).toBe(404);
  });

  it('returns 400 when body is not an array', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Array Test' });

    const res = await request(app)
      .put(`/api/stations/${station.body.station_id}/tracks`)
      .send({ canonical_id: 'c1' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/stations/:id/tracks/:trackId', () => {
  it('removes track and reorders positions', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'Delete Track' });
    const stationId = station.body.station_id;

    const t1 = await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c1', artist: 'A', title: 'Song 1', duration_ms: 100000 });
    const t2 = await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c2', artist: 'B', title: 'Song 2', duration_ms: 100000 });
    const t3 = await request(app)
      .post(`/api/stations/${stationId}/tracks`)
      .send({ canonical_id: 'c3', artist: 'C', title: 'Song 3', duration_ms: 100000 });

    // Delete the middle track
    const res = await request(app).delete(`/api/stations/${stationId}/tracks/${t2.body.id}`);
    expect(res.status).toBe(204);

    // Check reordering
    const stationRes = await request(app).get(`/api/stations/${stationId}`);
    expect(stationRes.body.tracklist).toHaveLength(2);
    expect(stationRes.body.tracklist[0].canonical_id).toBe('c1');
    expect(stationRes.body.tracklist[0].position).toBe(0);
    expect(stationRes.body.tracklist[1].canonical_id).toBe('c3');
    expect(stationRes.body.tracklist[1].position).toBe(1);
  });

  it('returns 404 for nonexistent track', async () => {
    const station = await request(app).post('/api/stations').send({ name: 'No Track' });

    const res = await request(app).delete(`/api/stations/${station.body.station_id}/tracks/nonexistent`);
    expect(res.status).toBe(404);
  });
});
