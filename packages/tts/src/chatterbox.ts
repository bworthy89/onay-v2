/** Interface for the Chatterbox TTS engine. */
export interface ChatterboxEngine {
  generateAudio(text: string, refWav: string, exaggeration: number): Promise<Buffer>;
}

/**
 * Build a valid WAV file buffer containing silence.
 *
 * PCM 16-bit mono @ 22050 Hz (Chatterbox's default sample rate).
 * Duration estimated at 80ms per character.
 */
function buildSilentWav(text: string): Buffer {
  const sampleRate = 22050;
  const bitsPerSample = 16;
  const numChannels = 1;
  const bytesPerSample = bitsPerSample / 8;

  const durationMs = text.length * 80;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * bytesPerSample;

  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);             // sub-chunk size
  buffer.writeUInt16LE(1, 20);              // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);              // block align
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk (all zeros = silence)
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Placeholder implementation that logs what it would generate
 * and returns a valid silent WAV buffer.
 *
 * Swap this out for the real Chatterbox inference engine later.
 */
export class PlaceholderChatterboxEngine implements ChatterboxEngine {
  async generateAudio(text: string, refWav: string, exaggeration: number): Promise<Buffer> {
    const preview = text.length > 80 ? text.slice(0, 77) + '...' : text;
    console.log(
      `  [chatterbox-stub] Would synthesize:\n` +
      `    text:          "${preview}"\n` +
      `    ref_wav:       ${refWav}\n` +
      `    exaggeration:  ${exaggeration}`,
    );

    return buildSilentWav(text);
  }
}
