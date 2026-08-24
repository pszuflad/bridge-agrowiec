/**
 * Zgodność hashy z produkcją.
 *
 * Staging startuje na snapshocie produkcji (`db/snapshot.db`), w którym `users.haslo_hash`
 * to bcrypt `$2b$10$…`. Gdyby nowy backend użył innego algorytmu (argon2/scrypt) albo
 * innego kosztu, konta Ani przestałyby się logować. Ten test pilnuje tego wymagania.
 */
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { KOSZT_BCRYPT, porownajHaslo, zahashujHaslo } from "../src/auth/password.js";

describe("bcrypt — zgodność z hashami produkcji", () => {
  it("koszt to 10, jak w oryginale", () => {
    expect(KOSZT_BCRYPT).toBe(10);
  });

  it("generuje hash w formacie $2b$10$", async () => {
    const hash = await zahashujHaslo("jakies-haslo-123");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("weryfikuje hash wygenerowany przez tę samą bibliotekę", async () => {
    const hash = await zahashujHaslo("jakies-haslo-123");
    expect(await porownajHaslo("jakies-haslo-123", hash)).toBe(true);
    expect(await porownajHaslo("inne-haslo", hash)).toBe(false);
  });

  it("weryfikuje hash w wariancie $2b$ zapisanym niezależnie (jak w snapshocie produkcji)", async () => {
    // Zapisany wariantem $2b$ — dokładnie taki format ma db/snapshot.db.
    const hashProdukcyjny = bcrypt.hashSync("haslo-z-produkcji", bcrypt.genSaltSync(10));
    expect(hashProdukcyjny).toMatch(/^\$2b\$10\$/);
    expect(await porownajHaslo("haslo-z-produkcji", hashProdukcyjny)).toBe(true);
    expect(await porownajHaslo("zle", hashProdukcyjny)).toBe(false);
  });

  it("radzi sobie z hashem $2a$ (starszy wariant) bez wyjątku", async () => {
    const hash2a = (await zahashujHaslo("abc")).replace(/^\$2b\$/, "$2a$");
    await expect(porownajHaslo("abc", hash2a)).resolves.toBe(true);
  });
});
