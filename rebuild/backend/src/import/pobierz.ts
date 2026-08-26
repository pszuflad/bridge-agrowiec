import { get as getHttp, type IncomingMessage } from "node:http";
import { get as getHttps } from "node:https";

/**
 * Pobranie pliku dostawcy spod URL — port `downloadUrl` z
 * `mirror/backend/extensions.cjs:26-45`.
 *
 * Świadomie na `node:http`/`node:https`, a nie na `fetch`: oryginał używa właśnie ich,
 * a różnice są odczuwalne — `fetch` inaczej traktuje przekierowania (sam je śledzi,
 * z własnym limitem), inaczej raportuje timeout i inaczej zachowuje się przy odpowiedziach
 * bez `content-length`. Odtwarzamy transport, nie tylko jego efekt.
 */

/** Timeout z oryginału (extensions.cjs:44). */
export const TIMEOUT_MS = 60_000;

/**
 * Limit skoków przy przekierowaniach — NASZ dodatek.
 *
 * ⚠ Oryginał wywołuje się rekurencyjnie bez licznika (extensions.cjs:30-33), więc pętla
 * przekierowań (A→B→A) kończy się przepełnieniem stosu albo wiszącym żądaniem. To nie jest
 * zachowanie, które warto odtwarzać — dokładamy licznik, zachowując resztę bez zmian.
 */
export const MAX_PRZEKIEROWAN = 10;

export function pobierzZUrl(url: string, pozostaloSkokow = MAX_PRZEKIEROWAN): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pobierz = url.startsWith("https") ? getHttps : getHttp;

    const zadanie = pobierz(url, (odpowiedz: IncomingMessage) => {
      const status = odpowiedz.statusCode ?? 0;

      if (status >= 300 && status < 400 && odpowiedz.headers.location) {
        // DODATEK (nieszkodliwy, nie zmienia obserwowalnego zachowania): oryginał porzuca
        // odpowiedź bez wyczytania ciała, przez co gniazdo wisi z zaległymi danymi aż do
        // zamknięcia. `resume()` opróżnia strumień; treść i tak jest tu nieużywana.
        odpowiedz.resume();
        if (pozostaloSkokow <= 0) {
          reject(new Error(`Za dużo przekierowań dla ${url}`));
          return;
        }
        pobierzZUrl(odpowiedz.headers.location, pozostaloSkokow - 1).then(resolve, reject);
        return;
      }

      if (status !== 200) {
        odpowiedz.resume(); // jw. — opróżniamy strumień, którego nie użyjemy
        reject(new Error(`HTTP ${status} dla ${url}`));
        return;
      }

      const kawalki: Buffer[] = [];
      odpowiedz.on("data", (c: Buffer) => kawalki.push(c));
      odpowiedz.on("end", () => resolve(Buffer.concat(kawalki)));
      odpowiedz.on("error", reject);
    });

    zadanie.on("error", reject);
    zadanie.setTimeout(TIMEOUT_MS, () => zadanie.destroy(new Error(`Timeout: ${url}`)));
  });
}
