// Bridge STAGING — placeholder health (Iteracja 0).
// Dowód, że pipeline test.agritires.eu -> Apache proxy -> Node:5001 działa,
// ZANIM powstanie prawdziwy backend (Iteracja 1). Wtedy ten proces zastąpi
// bridge-backend-staging z rebuild/backend (ten sam PM2 name).
//
// Nasłuch TYLKO na 127.0.0.1 (za proxy Apache) — bezpieczniej niż prod (0.0.0.0).
// Zero zależności (czysty Node), więc nie wymaga npm install.

const http = require('http');
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.url === '/api/health' || req.url === '/health') {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, stage: 'staging-placeholder', ts: new Date().toISOString() }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, error: 'placeholder: dostępne tylko /api/health' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[staging-placeholder] health na http://${HOST}:${PORT}/api/health`);
});
