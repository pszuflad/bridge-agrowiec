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
  if (input?.email !== EMAIL) throw new Error('Niepoprawne konto docelowe Agrorami.');
  if (typeof input.password !== 'string') throw new Error('Niepoprawny typ sekretu Agrorami.');
  // Puste linie wokół wklejonego sekretu nie są częścią hasła.
  const password = input.password.replace(/^[\r\n]+|[\r\n]+$/g, '');
  if (!password.length) throw new Error('Niepoprawny sekret Agrorami: pusta wartość.');
  if (password.includes('\0')) throw new Error('Niepoprawny sekret Agrorami: znak NUL.');
  if (/[\r\n]/.test(password)) {
    throw new Error('Niepoprawny sekret Agrorami: zawiera kilka wierszy. W GitHub Secret wpisz wyłącznie samo hasło.');
  }
  return { email: EMAIL, password };
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

function safeApiMessage(message, credentials) {
  let safe = message;
  for (const value of [credentials.email, credentials.password]) {
    for (const variant of [value, value.toLowerCase(), value.toUpperCase(),
      JSON.stringify(value).slice(1, -1), encodeURIComponent(value),
      Buffer.from(value).toString('base64')]) {
      if (variant) safe = safe.replaceAll(variant, '[ukryte]');
    }
  }
  return safe.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email ukryty]')
    .replace(/[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]+)*/g, '[identyfikator ukryty]')
    .replace(/[\r\n]/g, ' ').slice(0, 300);
}

async function validateLogin(credentials, transport = fetch) {
  let response;
  let result;
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
  } catch {
    throw new Error('Agrorami: błąd połączenia z API. Konfiguracji nie zmieniono.');
  }
  const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599
    ? response.status : 0;
  try { result = await response.json(); }
  catch { throw new Error(`Agrorami: API zwróciło niepoprawny JSON (HTTP ${status}). Konfiguracji nie zmieniono.`); }
  if (!response.ok) throw new Error(`Agrorami: błąd HTTP ${status}. Konfiguracji nie zmieniono.`);
  if (result.data?.generateCustomerToken?.token) return;
  // Klasyfikujemy treść odpowiedzi, ale nigdy jej nie wypisujemy: może odbijać sekret.
  const rawMessages = (Array.isArray(result.errors) ? result.errors : [])
    .map(error => typeof error.message === 'string' ? error.message : '')
    .filter(Boolean);
  if (typeof result.message === 'string') rawMessages.push(result.message);
  const messages = rawMessages.map(message => message.toLowerCase());
  const rejected = messages.some(message =>
    /nieprawidłowe|nieprawidlowe|incorrect|invalid credentials|account.*disabled|konto.*wyłącz|konto.*wylacz/.test(message));
  const schemaError = messages.some(message => /cannot query field|unknown argument|syntax error|variable.*required/.test(message));
  const captcha = messages.some(message => /captcha/.test(message));
  const confirmation = messages.some(message => /confirm|potwierdz/.test(message));
  const permission = messages.some(message => /unauthoriz|not authorized|permission|forbidden|uprawnie|autoryzac/.test(message));
  const reason = rejected ? 'odrzucone dane logowania lub konto czasowo wyłączone'
    : captcha ? 'API wymaga weryfikacji CAPTCHA'
    : confirmation ? 'API wymaga potwierdzenia konta'
    : permission ? 'API odrzuciło uprawnienia'
    : schemaError ? 'niezgodność mutacji GraphQL' : 'odpowiedź GraphQL bez tokenu';
  const detail = rawMessages.slice(0, 2).map(message => safeApiMessage(message, credentials)).join(' | ');
  throw new Error(`Agrorami: ${reason} (HTTP ${status}). Konfiguracji nie zmieniono.${detail ? ` Komunikat API po redakcji: ${detail}` : ''}`);
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

async function main(root, services = {}) {
  const login = services.validateLogin || validateLogin;
  const run = services.runWithEnv || runWithEnv;
  const readInput = services.readInput || (() => fs.readFileSync(0, 'utf8'));
  const expected = path.join(process.env.HOME, 'domains/agroopony.eu/public_html/bridgeone/_app');
  if (root !== expected) throw new Error('Dozwolona jest wyłącznie produkcja BridgeOne.');
  if (process.argv[3] === '--sync') return synchronize(root);
  const credentials = parseCredentials(readInput());
  await login(credentials);
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
    run(root, path.join(root, 'pm2.sh'), ['restart', 'bridge-backend-prod', '--update-env']);
    run(root, path.join(root, 'pm2.sh'), ['save']);
  } catch (error) {
    atomicWrite(env, original);
    try {
      run(root, path.join(root, 'pm2.sh'), ['restart', 'bridge-backend-prod', '--update-env']);
      run(root, path.join(root, 'pm2.sh'), ['save']);
    } catch {}
    atomicWrite(changelog, `${new Date().toISOString()}\nobszar: backend\n` +
      'zmiana: nieudany restart lub zapis PM2; przywrócono poprzedni .env.\n\n' +
      fs.readFileSync(changelog, 'utf8'));
    throw error;
  }
  const stdout = run(root, path.join(root, 'node/bin/node'), [__filename, root, '--sync']);
  console.log(stdout.trim());
}

module.exports = { parseCredentials, shellQuote, replaceEnv, validateLogin, safeApiMessage, main };
if (require.main === module) {
  main(process.argv[2]).catch(error => {
    // Nieoczekiwane błędy systemowe również bez treści mogącej zawierać sekret.
    const known = /^(Agrorami|Operacja backendu|Nie potwierdzono|Dozwolona|Niepopraw|Zbyt duży|Brak konfiguracji|Backend nie|Synchronizacja MO9)/;
    console.error(known.test(error.message) ? error.message : 'Konfiguracja Agrorami nie powiodła się; sprawdź stan na serwerze.');
    process.exitCode = 1;
  });
}
