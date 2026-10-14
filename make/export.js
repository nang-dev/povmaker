import { Muxer, ArrayBufferTarget } from "./vendor/mp4-muxer.mjs";
import { W, H } from "./brand.js";
import { renderFrame, END_CARD_S } from "./engine.js";
import { renderBed, RATE } from "./audio.js";

const CODECS = [["avc", "avc1.64002A"], ["avc", "avc1.640028"], ["avc", "avc1.4D002A"], ["vp9", "vp09.00.50.08"]];

const ACODECS = [["aac", "mp4a.40.2"], ["opus", "opus"]];
export const canAudioEncode = async () => {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return null;
  for (const [mux, codec] of ACODECS) {
    const cfg = { codec, sampleRate: RATE, numberOfChannels: 2, bitrate: 128_000 };
    try { const s = await AudioEncoder.isConfigSupported(cfg); if (s.supported) return { mux, cfg }; } catch {}
  }
  return null;
};

// Chrome hands us the 2-byte AudioSpecificConfig; Safari 26 hands us a whole MPEG-4 ES_Descriptor (03 .. 04 .. 05 02 11 90 ..).
// The muxer wants the bare ASC, so unwrap the descriptor when it is one. Without this Safari's MP4 has 0 channels / 22 kHz.
export function ascFrom(desc) {
  const b = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength);
  if (b[0] !== 0x03) return b;
  let i = 0;
  const len = () => { let l = 0, c; do { c = b[i++]; l = (l << 7) | (c & 0x7f); } while (c & 0x80 && i < b.length); return l; };
  i++; len(); i += 2;                                   // tag 03, length, ES_ID
  const fl = b[i++]; if (fl & 0x80) i += 2; if (fl & 0x40) i += 1 + b[i]; if (fl & 0x20) i += 2;
  if (b[i++] !== 0x04) return b;
  len(); i += 13;                                       // DecoderConfigDescriptor: objType, stream, buffer, bitrates
  if (b[i++] !== 0x05) return b;
  const n = len();
  return b.slice(i, i + n);
}

export const canWebCodecs = () => typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

export async function exportMp4({ tpl, params, fps, watermark, endCard, audio = true, onProgress }) {
  if (!canWebCodecs()) throw new Error("This browser can't export video yet. Please use Chrome, Edge or Safari 16.4+.");
  let pick = null;
  for (const [mux, codec] of CODECS) {
    const cfg = { codec, width: W, height: H, bitrate: 10_000_000, framerate: fps };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) { pick = { mux, cfg }; break; } } catch {}
  }
  if (!pick) throw new Error("No supported video encoder found in this browser.");
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  // video chunks are held until the video pass is done: the muxer is built afterwards, once we know whether this
  // browser can encode audio (probing AudioEncoder while a VideoEncoder is running stalled Safari 26).
  const vchunks = [];
  let err = null;
  const enc = new VideoEncoder({ output: (c, m) => vchunks.push([c, m]), error: (e) => { err = e; } });
  enc.configure(pick.cfg);
  const total = tpl.duration(params) + (endCard ? END_CARD_S : 0), frames = Math.round(total * fps);
  for (let i = 0; i < frames; i++) {
    if (err) throw err;
    renderFrame(ctx, tpl, params, i / fps, { watermark, endCard });
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (i % 6 === 0) { onProgress?.(i / frames); await new Promise((r) => setTimeout(r)); }
  }
  await enc.flush();
  const ap = audio ? await canAudioEncode() : null;
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: pick.mux, width: W, height: H, frameRate: fps },
    ...(ap ? { audio: { codec: ap.mux, numberOfChannels: 2, sampleRate: RATE } } : {}), fastStart: "in-memory" });
  for (const [c, m] of vchunks) muxer.addVideoChunk(c, m);
  if (ap) {
    // original synth bed (audio.js), stereo-duplicated, 1024-frame AudioData chunks into the AAC/Opus encoder
    const bed = renderBed(tpl, params, { endCard }).samples, N = Math.min(bed.length, Math.round(total * RATE));
    let aerr = null;
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m?.decoderConfig?.description ? { ...m, decoderConfig: { ...m.decoderConfig, description: ascFrom(m.decoderConfig.description) } } : m), error: (e) => { aerr = e; } });
    aenc.configure(ap.cfg);
    const STEP = 4096;
    for (let s = 0; s < N; s += STEP) {
      if (aerr) throw aerr;
      const n = Math.min(STEP, N - s), planar = new Float32Array(n * 2);
      planar.set(bed.subarray(s, s + n), 0); planar.set(bed.subarray(s, s + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s / RATE) * 1e6), data: planar });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush();
  }
  muxer.finalize();
  onProgress?.(1);
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  blob.hasAudio = !!ap;
  return blob;
}
