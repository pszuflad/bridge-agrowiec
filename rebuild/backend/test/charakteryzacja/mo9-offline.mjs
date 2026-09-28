// Uruchamia produkcyjny potok MO9 (Agrorami) BEZ sieci.
//
// Produkcyjny parser mo9_agrorami.cjs ignoruje ścieżkę pliku i odpala osobny proces
// (_agrorami_fetch_helper.cjs), który loguje się do GraphQL hurtowni i zwraca JSON na stdout.
// Nie da się z tego zrobić powtarzalnego gate'u — potrzebne są poświadczenia, a stany
// magazynowe zmieniają się co godzinę.
//
// Zamiast duplikować logikę fetchAll() (co byłoby przepisywaniem portowanego kodu, czyli
// dokładnie tym, czego ta iteracja unika), podstawiamy TYLKO transport HTTP: globalny fetch
// odpowiada nagraną odpowiedzią GraphQL zbudowaną z próbki. Dzięki temu realnie wykonuje się
// cały produkcyjny fetchAll() — generowanie tokenu, keyset-paginacja, wykrywanie błędów
// autoryzacji, odrzucanie quadów i itemToRecord(). Niepokryty zostaje wyłącznie sam kabel.
//
// Wynik przepuszczamy przez JSON.parse(JSON.stringify(...)), bo produkcja dostaje go tak samo:
// przez stdout procesu potomnego. To odtwarza m.in. gubienie wartości `undefined`.

const ZAPYTANIE_TOKENU = "generateCustomerToken";

const odpowiedzHttp = (cialo) => ({ status: 200, text: async () => JSON.stringify(cialo) });

/**
 * @param {{ fetchAll: () => Promise<{records: unknown[], errors: unknown[], odrzucone: unknown[], dostawca: string, totalCount: number|null}> }} modulApi
 *   moduł mo9_agrorami_api.cjs — portowany albo oryginalny, zależnie od strony porównania
 * @param {unknown[]} itemy obiekty `item` w kształcie odpowiedzi GraphQL
 */
export async function pobierzMo9Offline(modulApi, itemy) {
  const poprzedniFetch = globalThis.fetch;
  const poprzednieDaneLogowania = {
    email: process.env.AGRORAMI_EMAIL,
    haslo: process.env.AGRORAMI_PASSWORD,
  };

  // Parser wymaga obecności poświadczeń zanim w ogóle spróbuje sieci (_creds()).
  // To są wartości-atrapy na czas testu, nie żadne realne dane logowania.
  process.env.AGRORAMI_EMAIL = "charakteryzacja@example.invalid";
  process.env.AGRORAMI_PASSWORD = "charakteryzacja";

  globalThis.fetch = async (_url, opcje) => {
    const { query, variables } = JSON.parse(opcje.body);

    if (query.includes(ZAPYTANIE_TOKENU)) {
      return odpowiedzHttp({ data: { generateCustomerToken: { token: "token-charakteryzacji" } } });
    }

    // Odwzorowujemy keyset-paginację tak, jak robi to API: zwracamy tylko elementy
    // o id > kursor, nie więcej niż pageSize. Bez tego fetchAllItems() nigdy nie
    // trafiłby na warunek stopu, gdyby próbka urosła powyżej strony.
    const after = Number(variables.after);
    const strona = itemy
      .filter((it) => Number(it.id) > after)
      .sort((a, b) => Number(a.id) - Number(b.id))
      .slice(0, variables.pageSize);

    return odpowiedzHttp({
      data: { products: { total_count: itemy.length, items: strona } },
    });
  };

  try {
    const wynik = await modulApi.fetchAll();
    return JSON.parse(JSON.stringify(wynik));
  } finally {
    globalThis.fetch = poprzedniFetch;
    if (poprzednieDaneLogowania.email === undefined) delete process.env.AGRORAMI_EMAIL;
    else process.env.AGRORAMI_EMAIL = poprzednieDaneLogowania.email;
    if (poprzednieDaneLogowania.haslo === undefined) delete process.env.AGRORAMI_PASSWORD;
    else process.env.AGRORAMI_PASSWORD = poprzednieDaneLogowania.haslo;
  }
}
