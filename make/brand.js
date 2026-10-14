// POVMaker brand glue. The two kit modules (copied unchanged from shared/scenes/_kit-*/brand.js) live in kits/<brand>/.
import * as RTS from "./kits/ranthesim/brand.js";
import * as SC from "./kits/sidecharpov/brand.js";
export { RTS, SC };
export const W = 1080, H = 1920;
export const SAFE = RTS.SAFE;
// Public URL shown on free exports. Empty until we own a domain (Muse 2026-10-14: no personal GitHub handle on exports).
export const SITE = "";
export async function loadFonts() {
  await Promise.all([RTS.loadFonts("kits/ranthesim/"), SC.loadFonts("kits/sidecharpov/")]);
}
export const drawSafeOverlay = (ctx) => RTS.drawSafeOverlay(ctx);
