import { Muxer, ArrayBufferTarget } from "./vendor/mp4-muxer.mjs";
import { W, H } from "./brand.js";
import { renderFrame } from "./engine.js";

const CODECS = [["avc", "avc1.64002A"], ["avc", "avc1.640028"], ["avc", "avc1.4D002A"], ["vp9", "vp09.00.50.08"]];

export const canWebCodecs = () => typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

export async function exportMp4({ tpl, params, fps, watermark, endCard, onProgress }) {
  if (!canWebCodecs()) throw new Error("This browser can't export video yet. Please use Chrome, Edge or Safari 16.4+.");
  let pick = null;
  for (const [mux, codec] of CODECS) {
    const cfg = { codec, width: W, height: H, bitrate: 10_000_000, framerate: fps };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) { pick = { mux, cfg }; break; } } catch {}
  }
  if (!pick) throw new Error("No supported video encoder found in this browser.");
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: pick.mux, width: W, height: H, frameRate: fps }, fastStart: "in-memory" });
  let err = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { err = e; } });
  enc.configure(pick.cfg);
  const total = tpl.duration(params) + (endCard ? 1.2 : 0), frames = Math.round(total * fps);
  for (let i = 0; i < frames; i++) {
    if (err) throw err;
    renderFrame(ctx, tpl, params, i / fps, { watermark, endCard });
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (i % 6 === 0) { onProgress?.(i / frames); await new Promise((r) => setTimeout(r)); }
  }
  await enc.flush(); muxer.finalize();
  onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
