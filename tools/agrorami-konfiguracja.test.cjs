'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { parseCredentials, replaceEnv, validateLogin } = require('./agrorami-konfiguracja.cjs');

const credentials = { email: 'info@agroopony.eu', password: 'test-only-placeholder' };
test('payload wymaga właściwego konta i niepustego hasła', () => {
  assert.deepEqual(parseCredentials(JSON.stringify(credentials)), credentials);
  for (const text of ['bad-json', '{}', JSON.stringify({ ...credentials, email: 'other' }),
    JSON.stringify({ ...credentials, password: 'x\nBAD=1' }), ' '.repeat(17000)]) {
    assert.throws(() => parseCredentials(text));
  }
});
test('podmiana usuwa duplikaty i zachowuje inne ustawienia', () => {
  const result = replaceEnv('JWT_SECRET=unchanged\nAGRORAMI_EMAIL=old\nexport AGRORAMI_PASSWORD=old\nAGRORAMI_PASSWORD=duplicate\n', credentials);
  assert.equal((result.match(/^AGRORAMI_PASSWORD=/gm) || []).length, 1);
  assert.match(result, /^JWT_SECRET=unchanged\n/);
  assert.ok(!result.includes('duplicate'));
});
test('hasło nie staje się kodem powłoki', () => {
  const password = "test'$HOME`whoami`\\ \"!";
  const text = replaceEnv('', { ...credentials, password });
  const result = spawnSync('bash', ['-c', 'eval "$1"; printf "%s" "$AGRORAMI_PASSWORD"', 'test', text], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, password);
});
test('logowanie wysyła Store pl i poprawną mutację', async () => {
  await validateLogin(credentials, async (url, options) => {
    assert.equal(url, 'https://hurtownia.agrorami.pl/graphql');
    assert.equal(options.headers.Store, 'pl');
    assert.deepEqual(JSON.parse(options.body).variables, credentials);
    return { ok: true, json: async () => ({ data: { generateCustomerToken: { token: 'test-token' } } }) };
  });
});
test('odrzucenie loginu, błąd HTTP i błąd sieci nie ujawniają danych', async () => {
  for (const transport of [
    async () => ({ ok: true, json: async () => ({ errors: [{ message: credentials.password }] }) }),
    async () => ({ ok: false, json: async () => ({ data: { generateCustomerToken: { token: 'test' } } }) }),
    async () => { throw new Error(credentials.password); },
  ]) {
    await assert.rejects(validateLogin(credentials, transport), error =>
      !error.message.includes(credentials.password) && error.message.includes('Konfiguracji nie zmieniono'));
  }
});
