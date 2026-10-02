'use strict';
/* global URL, AbortSignal, Response */
// Ticket 183: transport MO9 poza nietykalnym portem legacy. Nigdy nie loguje tokenów ani hasła.
const { setTimeout: delay } = require('node:timers/promises');

function createTransport(fetchImpl, wait = delay, timeoutMs = 120000) {
  return async (input, options = {}) => {
    const url = new URL(String(input));
    const store = url.searchParams.get('store');
    url.searchParams.delete('store');
    const headers = { ...options.headers, ...(store ? { Store: store } : {}) };
    let stage = 'produkty';
    try {
      if (JSON.parse(options.body).query.includes('generateCustomerToken')) stage = 'logowanie';
    } catch { /* Klasyfikacja służy wyłącznie bezpiecznemu komunikatowi błędu. */ }
    for (let attempt = 1; attempt <= 3; attempt++) {
      let reason;
      let retry = false;
      try {
        // Nie dziedziczymy legacy AbortController (30 s). Każda próba ma własne 120 s.
        const response = await fetchImpl(url.toString(), {
          ...options, headers, signal: AbortSignal.timeout(timeoutMs),
        });
        const body = await response.text();
        let json;
        try { json = JSON.parse(body); } catch { /* Sprawdzenie poniżej. */ }
        const internal = json?.errors?.some(e => /internal server error/i.test(String(e.message)));
        if (response.status === 429 || response.status >= 500 || internal) {
          reason = internal ? 'API Agrorami zwraca Internal server error w GraphQL'
            : `API Agrorami zwraca HTTP ${response.status}`;
          retry = true;
        } else if (!json) {
          reason = `API Agrorami zwraca niepoprawny JSON (HTTP ${response.status})`;
        } else {
          // Odpowiedź odtworzona po odczycie body; legacy nadal parsuje ten sam JSON.
          return new Response(body, { status: response.status, headers: response.headers });
        }
      } catch (error) {
        reason = ['TimeoutError', 'AbortError'].includes(error.name)
          ? `przekroczono limit ${timeoutMs / 1000} s`
          : 'błąd sieci podczas połączenia z API Agrorami';
        retry = true;
      }
      if (!retry || attempt === 3) {
        throw new Error(`Agrorami (${stage}): ${reason}; próby: ${attempt}/3. Import zatrzymany bez zmiany katalogu.`);
      }
      await wait(2000 * attempt);
    }
  };
}

module.exports = { createTransport };

if (require.main === module) {
  globalThis.fetch = createTransport(globalThis.fetch);
  const api = require('./legacy/parsers/mo9_agrorami_api.cjs');
  api.fetchAll().then(async result => {
    await new Promise((resolve, reject) =>
      process.stdout.write(JSON.stringify(result), error => error ? reject(error) : resolve()));
  }).catch(error => {
    process.stderr.write(error.message);
    process.exitCode = 1;
  });
}
