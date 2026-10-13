#!/usr/bin/env node
'use strict';

// Sekret wyłącznie z stdin GitHub Actions. Nigdy argument CLI ani log.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const EMAIL = 'info@agroopony.eu';
const GRAPHQL = 'https://hurtownia.agrorami.pl/graphql';

function parseCredentials(text) {
  if (Buffer.byteLength(text) > 16384) throw new Error('Zbyt duży payload konfiguracji.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Niepoprawny payload konfiguracji.'); }
  if (input?.email !== EMAIL || typeof input.password !== 'string' ||
      !input.password.length || /[\0\r\n]/.test(input.password)) {
    throw new Error('Niepoprawne dane konfiguracji Agrorami.');
  }
  return { email: EMAIL, password: input.password };
}

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function replaceEnv(original, credentials) {
  const lines = original.split(/\r?\n/).filter(line =>
    !/^\s*(?:export\s+)?AGRORAMI_(?:EMAIL|PASSWORD)\s*=/.test(line));
  while (lines.at(-1) === '') lines.pop();
  return lines.join('\n') + '\n' +
    `AGRORAMI_EMAIL=${shellQuote(credentials.email)}\n` +
    `AGRORAMI_PASSWORD=${shellQuote(credentials.password)}\n`;
}

async function validateLogin(credentials, transport = fetch) {
  let response;
  try {
    response = await transport(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Store: 'pl' },
      body: JSON.stringify({
        query: 'mutation($email:String!,$password:String!){generateCustomerToken(email:$email,password:$password){token}}',
        variables: credentials,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const result = await response.json();
    if (!response.ok || !result.data?.generateCustomerToken?.token) {
      throw new Error('rejected');
    }
  } catch {
    // Odpowiedź API może zawierać dane wejścia; nie drukujemy jej.
    throw new Error('Agrorami odrzuciło logowanie lub API jest niedostępne. Konfiguracji nie zmieniono.');
  }
}

function runWithEnv(root, command, args) {
  const result = spawnSync('/bin/bash', [
    '-c', 'set -e; set -a; . "$1"; set +a; shift; exec "$@"',
    'agrorami-config', path.join(root, '.env'), command, ...args,
  ], { cwd: root, encoding: 'utf8', timeout: 780000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    // Nie przekazujemy stdout/stderr PM2, bo mogą ujawnić środowisko.
    throw new Error('Operacja backendu nie powiodła się; sprawdź log procesu na serwerze.');
  }
  return result.stdout;
}

function atomicWrite(file, text) {
  const temporary = `${file}.tmp_agrorami_${process.pid}`;
  try {
    fs.writeFileSync(temporary, text, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function synchronize(root) {
  const requireCurrent = createRequire(path.join(root, 'current/dist/server.js'));
  const Database = requireCurrent('better-sqlite3');
  const jwt = requireCurrent('jsonwebtoken');
  const db = new Database(path.join(root, 'data/data-prod.db'), { readonly: true });
  let user;
  let supplier;
  try {
    user = db.prepare('SELECT id, email, imie_nazwisko FROM users WHERE email = ?')
      .get('anna.naumowicz4@gmail.com');
    supplier = db.prepare("SELECT url FROM suppliers WHERE kod = 'MO9'").get();
  } finally { db.close(); }
  if (!user || !process.env.JWT_SECRET) throw new Error('Brak konfiguracji do kontrolnej synchronizacji.');
  const token = jwt.sign({
    id: user.id, email: user.email, imieNazwisko: user.imie_nazwisko,
  }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
  const started = Date.now();
  // Czekamy na restart, ale synchronizację wykonujemy tylko raz.
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/dostawcy', {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2000),
      });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Backend nie jest gotowy po restarcie.');
  const response = await fetch('http://127.0.0.1:5000/api/dostawcy/MO9/synchronizuj-teraz', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(660000),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false || result.error) {
    throw new Error('Synchronizacja MO9 nie powiodła się. Nowe dane logowania pozostawiono na serwerze.');
  }
  const check = new Database(path.join(root, 'data/data-prod.db'), { readonly: true });
  let status;
  try { status = check.prepare("SELECT status, ostatnia_sync FROM suppliers WHERE kod = 'MO9'").get(); }
  finally { check.close(); }
  const folder = String(supplier?.url || '').replace(/^plik:\/\//, '').replace(/^file:\/\//, '');
  const csv = path.join(folder, 'agrorami-api.csv');
  if (!path.isAbsolute(folder) || !fs.existsSync(csv) ||
      fs.statSync(csv).mtimeMs < started - 1000 ||
      status?.status !== 'aktywny' || Date.parse(status.ostatnia_sync) < started - 1000) {
    throw new Error('Nie potwierdzono aktualnego CSV i aktywnego statusu MO9.');
  }
  console.log('MO9: synchronizacja OK; aktualny agrorami-api.csv; status aktywny.');
}

async function main(root) {
  const expected = path.join(process.env.HOME, 'domains/agroopony.eu/public_html/bridgeone/_app');
  if (root !== expected) throw new Error('Dozwolona jest wyłącznie produkcja BridgeOne.');
  if (process.argv[3] === '--sync') return synchronize(root);
  const credentials = parseCredentials(fs.readFileSync(0, 'utf8'));
  await validateLogin(credentials);
  console.log('Agrorami: nowy token pobrany poprawnie (wartość ukryta).');
  const env = path.join(root, '.env');
  const original = fs.readFileSync(env, 'utf8');
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const backup = `${env}.bak_agrorami_${stamp}`;
  fs.copyFileSync(env, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  atomicWrite(env, replaceEnv(original, credentials));
  const changelog = path.join(root, 'CHANGELOG.md');
  const oldLog = fs.existsSync(changelog) ? fs.readFileSync(changelog, 'utf8') : '';
  const logBackup = `${changelog}.bak_agrorami_${stamp}`;
  if (fs.existsSync(changelog)) fs.copyFileSync(changelog, logBackup, fs.constants.COPYFILE_EXCL);
  atomicWrite(changelog,
    `${new Date().toISOString()}\nobszar: backend\n` +
    `pliki: .env, ${path.basename(backup)}, CHANGELOG.md, ${path.basename(logBackup)}\n` +
    'zmiana: aktualizacja danych Agrorami z GitHub Secrets po poprawnym teście tokenu; restart backendu i kontrola MO9.\n' +
    'powód: przywrócenie aktualizacji cen i stanów MO9 na prośbę właścicielki.\n\n' + oldLog);
  try {
    runWithEnv(root, path.join(root, 'pm2.sh'), ['restart', 'bridge-backend-prod', '--update-env']);
  } catch (error) {
    atomicWrite(env, original);
    try { runWithEnv(root, path.join(root, 'pm2.sh'), ['restart', 'bridge-backend-prod', '--update-env']); } catch {}
    fs.appendFileSync(changelog, '\nAgrorami: restart nieudany, przywrócono poprzedni .env.\n');
    throw error;
  }
  const stdout = runWithEnv(root, path.join(root, 'node/bin/node'), [__filename, root, '--sync']);
  console.log(stdout.trim());
}

module.exports = { parseCredentials, shellQuote, replaceEnv, validateLogin };
if (require.main === module) {
  main(process.argv[2]).catch(error => {
    // Nieoczekiwane błędy systemowe również bez treści mogącej zawierać sekret.
    const known = /^(Agrorami|Operacja backendu|Nie potwierdzono|Dozwolona|Niepopraw|Zbyt duży|Brak konfiguracji|Backend nie|Synchronizacja MO9)/;
    console.error(known.test(error.message) ? error.message : 'Konfiguracja Agrorami nie powiodła się; sprawdź stan na serwerze.');
    process.exitCode = 1;
  });
}
