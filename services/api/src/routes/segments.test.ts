import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_AUDIO_DIR = path.join(os.tmpdir(), `onay-test-segments-${Date.now()}`);
process.env.SEGMENT_AUDIO_DIR = TEST_AUDIO_DIR;

vi.mock('../db.js', async () => {
  const { createTestDb } = await import('../test-setup.js');
  return { default: createTestDb() };
});

import request from 'supertest';
import app from '../app.js';
import db from '../db.js';

function createTestWav(): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(88200, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(0, 40);
  return header;
}

function insertSegment(overrides: Record<string, unknown> = {}) {
  const defaults = {
    segment_id: `SEG-TR-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
    type: 'transition',
    genre_tags: '["hip-hop"]',
    mood_tags: '["chill"]',
    artist_refs: '[]',
    energy_level: 3,
    duration_ms: 5000,
    quality_score: 0.7,
    exaggeration_level: 0.5,
    audio_url: null,
    script_text: 'Test script text',
    status: 'pending',
  };

  const data = { ...defaults, ...overrides };

  db.prepare(
    `INSERT INTO segments (segment_id, type, genre_tags, mood_tags, artist_refs, energy_level, duration_ms, quality_score, exaggeration_level, audio_url, script_text, status)
     VALUES (@segment_id, @type, @genre_tags, @mood_tags, @artist_refs, @energy_level, @duration_ms, @quality_score, @exaggeration_level, @audio_url, @script_text, @status)`
  ).run(data);

  return data;
}

beforeEach(() => {
  db.exec('DELETE FROM timeline_history');
  db.exec('DELETE FROM timelines');
  db.exec('DELETE FROM station_tracks');
  db.exec('DELETE FROM segments');
  db.exec('DELETE FROM stations');
});

afterAll(() => {
  if (fs.existsSync(TEST_AUDIO_DIR)) {
    fs.rmSync(TEST_AUDIO_DIR, { recursive: true });
  }
});

describe('POST /api/segments', () => {
  it('uploads a segment with audio file', async () => {
    const wav = createTestWav();

    const res = await request(app)
      .post('/api/segments')
      .attach('audio', wav, 'test.wav')
      .field('type', 'transition')
      .field('genre_tags', '["hip-hop", "r&b"]')
      .field('mood_tags', '["chill"]')
      .field('artist_refs', '["SZA"]')
      .field('energy_level', '3')
      .field('duration_ms', '5000')
      .field('quality_score', '0.8')
      .field('exaggeration_level', '0.5')
      .field('script_text', 'Yo, that was SZA with Kill Bill');

    expect(res.status).toBe(201);
    expect(res.body.segment_id).toBeDefined();
    expect(res.body.type).toBe('transition');
    expect(res.body.genre_tags).toEqual(['hip-hop', 'r&b']);
    expect(res.body.artist_refs).toEqual(['SZA']);
    expect(res.body.audio_url).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('creates a segment without audio file', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('type', 'show_intro')
      .field('duration_ms', '3000')
      .field('script_text', 'Welcome to Onay Radio');

    expect(res.status).toBe(201);
    expect(res.body.audio_url).toBeNull();
  });

  it('accepts a custom segment_id', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('segment_id', 'SEG-SI-99999')
      .field('type', 'show_intro')
      .field('duration_ms', '3000')
      .field('script_text', 'Custom ID test');

    expect(res.status).toBe(201);
    expect(res.body.segment_id).toBe('SEG-SI-99999');
  });

  it('returns 400 for missing type', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('duration_ms', '3000')
      .field('script_text', 'No type');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('returns 400 for invalid type', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('type', 'invalid_type')
      .field('duration_ms', '3000')
      .field('script_text', 'Bad type');

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing script_text', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('type', 'transition')
      .field('duration_ms', '3000');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/script_text/i);
  });

  it('returns 400 for missing duration_ms', async () => {
    const res = await request(app)
      .post('/api/segments')
      .field('type', 'transition')
      .field('script_text', 'No duration');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration_ms/i);
  });

  it('rejects non-audio file types with 400', async () => {
    const res = await request(app)
      .post('/api/segments')
      .attach('audio', Buffer.from('not audio'), 'test.txt')
      .field('type', 'transition')
      .field('duration_ms', '3000')
      .field('script_text', 'Bad file');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/segments', () => {
  it('returns paginated segments', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001' });
    insertSegment({ segment_id: 'SEG-TR-00002' });

    const res = await request(app).get('/api/segments');

    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('returns empty when no segments exist', async () => {
    const res = await request(app).get('/api/segments');

    expect(res.body.segments).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('filters by type', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', type: 'transition' });
    insertSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro' });

    const res = await request(app).get('/api/segments?type=transition');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].type).toBe('transition');
    expect(res.body.total).toBe(1);
  });

  it('filters by genre', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', genre_tags: '["hip-hop"]' });
    insertSegment({ segment_id: 'SEG-TR-00002', genre_tags: '["jazz"]' });

    const res = await request(app).get('/api/segments?genre=hip-hop');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('filters by mood', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', mood_tags: '["chill", "late-night"]' });
    insertSegment({ segment_id: 'SEG-TR-00002', mood_tags: '["hype"]' });

    const res = await request(app).get('/api/segments?mood=chill');

    expect(res.body.segments).toHaveLength(1);
  });

  it('filters by artist', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', artist_refs: '["SZA", "Frank Ocean"]' });
    insertSegment({ segment_id: 'SEG-TR-00002', artist_refs: '["Kendrick"]' });

    const res = await request(app).get('/api/segments?artist=SZA');

    expect(res.body.segments).toHaveLength(1);
  });

  it('filters by energy range', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', energy_level: 2 });
    insertSegment({ segment_id: 'SEG-TR-00002', energy_level: 4 });
    insertSegment({ segment_id: 'SEG-TR-00003', energy_level: 5 });

    const res = await request(app).get('/api/segments?energyMin=3&energyMax=4');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].energy_level).toBe(4);
  });

  it('filters by quality minimum', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', quality_score: 0.3 });
    insertSegment({ segment_id: 'SEG-TR-00002', quality_score: 0.8 });

    const res = await request(app).get('/api/segments?qualityMin=0.5');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].quality_score).toBe(0.8);
  });

  it('searches by script text', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', script_text: 'Yo, that was SZA' });
    insertSegment({ segment_id: 'SEG-TR-00002', script_text: 'Coming up next' });

    const res = await request(app).get('/api/segments?search=SZA');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].script_text).toContain('SZA');
  });

  it('combines multiple filters', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', type: 'transition', energy_level: 4, genre_tags: '["hip-hop"]' });
    insertSegment({ segment_id: 'SEG-TR-00002', type: 'transition', energy_level: 2, genre_tags: '["hip-hop"]' });
    insertSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', energy_level: 4, genre_tags: '["hip-hop"]' });

    const res = await request(app).get('/api/segments?type=transition&energyMin=3&genre=hip-hop');

    expect(res.body.segments).toHaveLength(1);
    expect(res.body.segments[0].segment_id).toBe('SEG-TR-00001');
  });

  it('respects limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      insertSegment({ segment_id: `SEG-TR-${String(i).padStart(5, '0')}` });
    }

    const res = await request(app).get('/api/segments?limit=2&offset=1');

    expect(res.body.segments).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });
});

describe('GET /api/segments/:id', () => {
  it('returns a single segment', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', script_text: 'Found me' });

    const res = await request(app).get('/api/segments/SEG-TR-00001');

    expect(res.status).toBe(200);
    expect(res.body.segment_id).toBe('SEG-TR-00001');
    expect(res.body.script_text).toBe('Found me');
  });

  it('returns 404 for nonexistent segment', async () => {
    const res = await request(app).get('/api/segments/SEG-NOPE-00000');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('PUT /api/segments/:id', () => {
  it('updates segment metadata', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', quality_score: 0.5 });

    const res = await request(app)
      .put('/api/segments/SEG-TR-00001')
      .send({ quality_score: 0.9, status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.quality_score).toBe(0.9);
    expect(res.body.status).toBe('approved');
  });

  it('partially updates — leaves other fields intact', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', energy_level: 3, script_text: 'Keep this' });

    const res = await request(app)
      .put('/api/segments/SEG-TR-00001')
      .send({ energy_level: 5 });

    expect(res.body.energy_level).toBe(5);
    expect(res.body.script_text).toBe('Keep this');
  });

  it('updates tags', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001' });

    const res = await request(app)
      .put('/api/segments/SEG-TR-00001')
      .send({ genre_tags: ['jazz', 'soul'], mood_tags: ['smooth'] });

    expect(res.body.genre_tags).toEqual(['jazz', 'soul']);
    expect(res.body.mood_tags).toEqual(['smooth']);
  });

  it('returns 404 for nonexistent segment', async () => {
    const res = await request(app)
      .put('/api/segments/SEG-NOPE-00000')
      .send({ quality_score: 0.9 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/segments/:id', () => {
  it('deletes a segment and returns 204', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001' });

    const res = await request(app).delete('/api/segments/SEG-TR-00001');

    expect(res.status).toBe(204);

    const check = await request(app).get('/api/segments/SEG-TR-00001');
    expect(check.status).toBe(404);
  });

  it('returns 404 for nonexistent segment', async () => {
    const res = await request(app).delete('/api/segments/SEG-NOPE-00000');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/segments/bulk-approve', () => {
  it('approves segments above quality threshold', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', quality_score: 0.3 });
    insertSegment({ segment_id: 'SEG-TR-00002', quality_score: 0.7 });
    insertSegment({ segment_id: 'SEG-TR-00003', quality_score: 0.9 });

    const res = await request(app)
      .post('/api/segments/bulk-approve')
      .send({ quality_threshold: 0.6 });

    expect(res.status).toBe(200);
    expect(res.body.approved_count).toBe(2);

    // Verify the statuses
    const seg1 = await request(app).get('/api/segments/SEG-TR-00001');
    expect(seg1.body.status).toBe('pending');

    const seg2 = await request(app).get('/api/segments/SEG-TR-00002');
    expect(seg2.body.status).toBe('approved');
  });

  it('skips already approved segments', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', quality_score: 0.8, status: 'approved' });
    insertSegment({ segment_id: 'SEG-TR-00002', quality_score: 0.9 });

    const res = await request(app)
      .post('/api/segments/bulk-approve')
      .send({ quality_threshold: 0.5 });

    expect(res.body.approved_count).toBe(1);
  });

  it('returns 400 when quality_threshold is missing', async () => {
    const res = await request(app)
      .post('/api/segments/bulk-approve')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when quality_threshold is not a number', async () => {
    const res = await request(app)
      .post('/api/segments/bulk-approve')
      .send({ quality_threshold: 'high' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/segments/stats', () => {
  it('returns library statistics', async () => {
    insertSegment({ segment_id: 'SEG-TR-00001', type: 'transition', quality_score: 0.6, duration_ms: 3000 });
    insertSegment({ segment_id: 'SEG-TR-00002', type: 'transition', quality_score: 0.8, duration_ms: 5000 });
    insertSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', quality_score: 0.9, duration_ms: 7000 });

    const res = await request(app).get('/api/segments/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.by_type.transition).toBe(2);
    expect(res.body.by_type.show_intro).toBe(1);
    expect(res.body.avg_quality).toBeCloseTo(0.767, 1);
    expect(res.body.total_duration_ms).toBe(15000);
  });

  it('returns zeros when library is empty', async () => {
    const res = await request(app).get('/api/segments/stats');

    expect(res.body.total).toBe(0);
    expect(res.body.by_type).toEqual({});
    expect(res.body.avg_quality).toBe(0);
    expect(res.body.total_duration_ms).toBe(0);
  });
});
