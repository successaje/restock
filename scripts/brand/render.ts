// Renders the social preview image and app icons from HTML with headless
// Chrome, at exact pixel sizes. Run: npm run brand
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../web/public");

const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.");

function shot(page: string, file: string, w: number, h: number, query = "") {
  execFileSync(
    chrome!,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--allow-file-access-from-files",
      "--virtual-time-budget=1500",
      `--window-size=${w},${h}`,
      `--screenshot=${join(out, file)}`,
      pathToFileURL(join(here, page)).href + query,
    ],
    { stdio: "ignore" },
  );
  console.log(`✓ web/public/${file} (${w}×${h})`);
}

shot("og.html", "og.png", 1200, 630);
// Headless Chrome won't open a window narrower than ~500px, so the icon is
// drawn once at 512 and resampled down (macOS `sips`) for the smaller sizes.
shot("icon.html", "icon-512.png", 512, 512, "?size=512");
for (const [file, n] of [["apple-touch-icon.png", 180], ["icon-192.png", 192]] as const) {
  execFileSync("sips", ["-z", String(n), String(n), join(out, "icon-512.png"), "--out", join(out, file)], { stdio: "ignore" });
  console.log(`✓ web/public/${file} (${n}×${n})`);
}
