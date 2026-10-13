'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseCredentials, replaceEnv, validateLogin, main } = require('./agrorami-konfiguracja.cjs');

const credentials = { email: 'info@agroopony.eu', password: 'test-only-placeholder' };
function workflowPayload(password) {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/agrorami-konfiguracja.yml'), 'utf8');
  const producer = workflow.match(/node -e '([\s\S]*?)' \|/);
  assert.ok(producer, 'workflow zawiera producenta JSON');
  let output = '';
  vm.runInNewContext(producer[1], {
    process: { env: { AGRORAMI_PASSWORD: password }, stdout: { write: text => { output += text; } } },
  });
  return JSON.parse(output);
}
test('workflow usuwa tylko końcowe CR/LF, zachowując znaki hasła', () => {
  for (const suffix of ['\n', '\r\n', '\n\n', '']) {
    const password = " test'$HOME`cmd` ! ";
    const payload = workflowPayload(password + suffix);
    assert.equal(payload.password, password);
    assert.deepEqual(parseCredentials(JSON.stringify(payload)), { ...credentials, password });
  }
});
test('workflow nadal odrzuca złamanie linii wewnątrz i puste hasło', () => {
  for (const password of ['first\nsecond\n', '\n', '\r\n']) {
    assert.throws(() => parseCredentials(JSON.stringify(workflowPayload(password))));
  }
});
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
async function sandbox(callback) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agrorami-test-'));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  const root = path.join(home, 'domains/agroopony.eu/public_html/bridgeone/_app');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, '.env'), 'JWT_SECRET=unchanged\nAGRORAMI_EMAIL=old\nAGRORAMI_PASSWORD=old\n');
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), 'old history\n');
  try { await callback(root); }
  finally {
    process.env.HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  }
}
test('nieudany test API nie zmienia plików i nie restartuje backendu', async () => {
  await sandbox(async root => {
    const before = fs.readFileSync(path.join(root, '.env'), 'utf8');
    await assert.rejects(main(root, {
      readInput: () => JSON.stringify(credentials),
      validateLogin: async () => { throw new Error('rejected'); },
      runWithEnv: () => { assert.fail('Backend nie powinien być uruchamiany'); },
    }));
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), before);
    assert.deepEqual(fs.readdirSync(root).sort(), ['.env', 'CHANGELOG.md']);
  });
});
test('poprawna konfiguracja: chroniona kopia, changelog, restart, zapis PM2 i jedna synchronizacja', async () => {
  await sandbox(async root => {
    const calls = [];
    await main(root, {
      readInput: () => JSON.stringify(credentials), validateLogin: async () => {},
      runWithEnv: (_root, command, args) => {
        calls.push({ command, args });
        return 'MO9: test-only successful verification';
      },
    });
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    assert.match(env, /^JWT_SECRET=unchanged/m);
    assert.match(env, /AGRORAMI_EMAIL='info@agroopony.eu'/);
    const backup = fs.readdirSync(root).find(name => name.startsWith('.env.bak_agrorami_'));
    assert.ok(backup);
    assert.equal(fs.statSync(path.join(root, backup)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(root, '.env')).mode & 0o777, 0o600);
    const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
    assert.ok(log.endsWith('old history\n'));
    assert.ok(!log.includes(credentials.password));
    assert.deepEqual(calls.map(call => call.args[0]), ['restart', 'save', require.resolve('./agrorami-konfiguracja.cjs')]);
    assert.equal(calls.at(-1).args.at(-1), '--sync');
  });
});
test('błąd restartu przywraca poprzedni env i nie uruchamia synchronizacji', async () => {
  await sandbox(async root => {
    const before = fs.readFileSync(path.join(root, '.env'), 'utf8');
    let count = 0;
    await assert.rejects(main(root, {
      readInput: () => JSON.stringify(credentials), validateLogin: async () => {},
      runWithEnv: (_root, command) => {
        assert.ok(command.endsWith('pm2.sh'));
        if (++count === 1) throw new Error('restart failed');
        return '';
      },
    }));
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), before);
    assert.equal(count, 3);
  });
});
