const path = require('path');
const DISPATCHER = require('/home/admin/private_apps/bridge/parsers/dispatcher.cjs');
const ADAPTER = require('/home/admin/private_apps/bridge/parsers/adapter.cjs');
console.log('Adapter keys:', Object.keys(ADAPTER));
console.log('recordsToSurowe type:', typeof ADAPTER.recordsToSurowe);
const parsed = DISPATCHER.parseByKod('MO2', '/tmp/mo2_rebuild.csv');
console.log('parsed keys:', Object.keys(parsed||{}));
console.log('typeof parsed.records:', typeof parsed.records, Array.isArray(parsed.records), parsed.records && parsed.records.length);
console.log('sample record[0]:', JSON.stringify(parsed.records[0]).slice(0,400));
