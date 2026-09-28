/**
 * Prosty magazyn klucz-wartość na IndexedDB — 1:1 z oryginałem
 * (`deminified/frontend-index.js:9161-9192`: baza `bridge-store-v2`, store `kv`).
 *
 * Oryginał POŁYKA wszystkie błędy: odczyt zwraca `undefined`, zapis tylko ostrzega
 * w konsoli. To jest zamierzone — brak IndexedDB (tryb prywatny, zablokowane dane
 * witryny, jsdom w testach) nie może wywrócić widoku, a jedynie cofnąć go do wartości
 * domyślnych. Zachowujemy to zachowanie.
 */

const NAZWA_BAZY = "bridge-store-v2";
const NAZWA_STORE = "kv";

/** Klucz, pod którym katalog trzyma wybór widocznych kolumn (frontend-index.js:23022). */
export const KLUCZ_KOLUMN_KATALOGU = "konfig-domyslne-kolumny";

function otworz(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const zadanie = indexedDB.open(NAZWA_BAZY, 1);
    zadanie.onupgradeneeded = () => {
      zadanie.result.createObjectStore(NAZWA_STORE);
    };
    zadanie.onsuccess = () => resolve(zadanie.result);
    zadanie.onerror = () => reject(zadanie.error);
  });
}

export async function odczytajKV<T>(klucz: string): Promise<T | undefined> {
  try {
    const baza = await otworz();
    return await new Promise<T | undefined>((resolve, reject) => {
      const zadanie = baza.transaction(NAZWA_STORE, "readonly").objectStore(NAZWA_STORE).get(klucz);
      zadanie.onsuccess = () => resolve(zadanie.result as T | undefined);
      zadanie.onerror = () => reject(zadanie.error);
    });
  } catch {
    return undefined;
  }
}

export async function zapiszKV(klucz: string, wartosc: unknown): Promise<void> {
  try {
    const baza = await otworz();
    await new Promise<void>((resolve, reject) => {
      const transakcja = baza.transaction(NAZWA_STORE, "readwrite");
      transakcja.objectStore(NAZWA_STORE).put(wartosc, klucz);
      transakcja.oncomplete = () => resolve();
      transakcja.onerror = () => reject(transakcja.error);
    });
  } catch (blad) {
    console.warn("IndexedDB save failed:", blad);
  }
}
