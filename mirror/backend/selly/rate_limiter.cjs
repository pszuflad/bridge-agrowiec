// backend/selly/rate_limiter.cjs
// Prosty token bucket dla API Selly.
// Selly oficjalny limit (docs): 300 req/60s per klucz API.
// Trzymamy sie bezpiecznie: 250/60 sek = ~4.2/sek (bufor 17% na overhead auth/dict + zapas na retry).
//
// Data: 2026-09-07 (v2 po korekcie z 400 na 250 - trafial 429 przy discovery burst)

'use strict';

const MAX_REQUESTS = 250;
const WINDOW_MS = 60_000;
const MIN_INTERVAL_MS = Math.ceil(WINDOW_MS / MAX_REQUESTS); // ~240ms

class RateLimiter {
  constructor(maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  async acquire() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = (oldest + this.windowMs) - now + 10;
      if (waitMs > 0) {
        await new Promise(r => setTimeout(r, waitMs));
        return this.acquire();
      }
    }

    if (this.timestamps.length > 0) {
      const lastTs = this.timestamps[this.timestamps.length - 1];
      const sinceLast = now - lastTs;
      if (sinceLast < MIN_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - sinceLast));
      }
    }

    this.timestamps.push(Date.now());
  }

  getStats() {
    const now = Date.now();
    const recent = this.timestamps.filter(t => now - t < this.windowMs);
    return {
      requestsInWindow: recent.length,
      capacity: this.maxRequests,
      utilizationPct: Math.round(100 * recent.length / this.maxRequests),
    };
  }
}

const globalLimiter = new RateLimiter();

module.exports = {
  RateLimiter,
  globalLimiter,
  MAX_REQUESTS,
  WINDOW_MS,
  MIN_INTERVAL_MS,
};
