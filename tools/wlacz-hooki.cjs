// Ten sam cel co tools/wlacz-hooki.sh, ale bez zależności od powłoki — wołany z `npm install`
// (skrypt `prepare` w rebuild/backend/package.json), żeby nowe środowisko dostało hooki samo.
// Nigdy nie wywraca instalacji: brak gita, brak repo, katalog CI bez .git → cicho wychodzi.
const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

try {
  const korzen = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!existsSync(join(korzen, ".githooks"))) process.exit(0);
  const obecny = (() => {
    try {
      return execFileSync("git", ["config", "--get", "core.hooksPath"], {
        cwd: korzen, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch { return ""; }
  })();
  if (obecny === ".githooks") process.exit(0);
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: korzen, stdio: "ignore" });
  console.log("✓ Włączono hooki repo (core.hooksPath = .githooks) — pre-push pilnuje sync z develop.");
} catch {
  // brak gita / nie-repo / brak uprawnień — hooki to wygoda, nie warunek instalacji
}
