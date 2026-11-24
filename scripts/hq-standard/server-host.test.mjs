import test from 'node:test';
import assert from 'node:assert/strict';
import { networkInterfaces } from 'node:os';
import { request } from 'node:http';
import { isPrivateIpv4, startHqServer } from './server.mjs';

function status(host, port, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: host, port, path: '/api/hq/bootstrap', headers }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('HQ mock accepts only an explicit private address or loopback', async () => {
  for (const host of ['0.0.0.0', '8.8.8.8', '192.169.20.30', 'example.com']) {
    assert.equal(isPrivateIpv4(host), false);
    await assert.rejects(startHqServer({ host, port: 0, storageDir: false }), /loopback or an explicitly configured private IPv4/);
  }
  for (const host of ['10.1.2.3', '172.16.1.2', '172.31.1.2', '192.168.20.30']) assert.equal(isPrivateIpv4(host), true);
});

const privateHost = Object.values(networkInterfaces()).flat().find(entry => entry?.family === 'IPv4' && !entry.internal && isPrivateIpv4(entry.address))?.address;
test('explicit LAN bind serves HQ and rejects foreign Host and Origin', { skip: !privateHost }, async () => {
  const runtime = await startHqServer({ host: privateHost, port: 0, storageDir: false });
  try {
    const port = runtime.server.address().port;
    assert.equal(await status(privateHost, port), 200);
    assert.equal(await status(privateHost, port, { Host: 'attacker.test' }), 403);
    assert.equal(await status(privateHost, port, { Origin: 'http://attacker.test' }), 403);
  } finally {
    runtime.server.closeAllConnections();
    await runtime.close();
  }
});
