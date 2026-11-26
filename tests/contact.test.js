// Run with: node --test tests/contact.test.js
// No dependencies. Drives the real handlers with a fake req/res and fetch.

const test = require('node:test');
const assert = require('node:assert');

process.env.RESEND_API_KEY = 're_test';
const contact = require('../api/contact');
const formToken = require('../api/form-token');

const realNow = Date.now;
let ipCounter = 0;

function makeReq(ip, method, body) {
  return { method, body, headers: { origin: 'https://lemautomator.work', 'x-forwarded-for': ip } };
}

async function call(handler, req) {
  const res = {
    code: 200, json: undefined, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(j) { this.json = j; return this; },
  };
  const send = res.json;
  res.json = function (j) { res.body = j; return send.call(this, j); };
  await handler(req, res);
  return res;
}

// Mints a token that already satisfies the minimum age.
async function agedToken(ip, ageMs = 10000) {
  Date.now = () => realNow() - ageMs;
  try { return (await call(formToken, makeReq(ip, 'GET'))).body.token; }
  finally { Date.now = realNow; }
}

const freshIp = () => `10.0.${++ipCounter}.1`;
const fields = { name: 'Ada', email: 'ada@example.com', message: 'Please automate my invoices.' };

function mockResend() {
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, text: async () => '' }; };
  return calls;
}

test('a valid submission reaches Resend', async () => {
  const calls = mockResend();
  const ip = freshIp();
  const res = await call(contact, makeReq(ip, 'POST', { ...fields, formToken: await agedToken(ip) }));
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
});

test('a visitor who changed network is told to retry, not silently dropped', async () => {
  const calls = mockResend();
  const token = await agedToken(freshIp());
  const res = await call(contact, makeReq(freshIp(), 'POST', { ...fields, formToken: token }));
  assert.equal(res.code, 400);
  assert.equal(res.body.retry, true);
  assert.equal(calls.length, 0);
});

test('an expired token asks the client to retry', async () => {
  mockResend();
  const ip = freshIp();
  const token = await agedToken(ip, 3 * 60 * 60 * 1000);
  const res = await call(contact, makeReq(ip, 'POST', { ...fields, formToken: token }));
  assert.equal(res.code, 400);
  assert.equal(res.body.retry, true);
});

test('a forged token gets the silent 200 and sends nothing', async () => {
  const calls = mockResend();
  const res = await call(contact, makeReq(freshIp(), 'POST', { ...fields, formToken: 'abc.def' }));
  assert.equal(res.code, 200);
  assert.equal(calls.length, 0);
});

test('zero-compressed IPv6 in the same /64 keeps the token valid', async () => {
  const calls = mockResend();
  const token = await agedToken('2a02:1::abcd');
  const res = await call(contact, makeReq('2a02:1:0:0:a:b:c:d', 'POST', { ...fields, formToken: token }));
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
});

test('a different IPv6 /64 is still rejected', async () => {
  mockResend();
  const token = await agedToken('2a02:1:0:1::1');
  const res = await call(contact, makeReq('2a02:1:0:2::1', 'POST', { ...fields, formToken: token }));
  assert.equal(res.code, 400);
});

test('malformed forwarded addresses do not crash the handler', async () => {
  mockResend();
  const res = await call(formToken, makeReq('1:2:3:4:5:6:7:8::9:a', 'GET'));
  assert.equal(res.code, 200);
});

test('the honeypot traps and sends nothing', async () => {
  const calls = mockResend();
  const ip = freshIp();
  const res = await call(contact, makeReq(ip, 'POST', { ...fields, homepage_url: 'x', formToken: await agedToken(ip) }));
  assert.equal(res.code, 200);
  assert.equal(calls.length, 0);
});

test('missing mail config is reported, never faked as success', async (t) => {
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  t.after(() => { process.env.RESEND_API_KEY = key; });
  const res = await call(contact, makeReq(freshIp(), 'POST', { ...fields, formToken: 'x.y' }));
  assert.equal(res.code, 500);
});

test('a hung Resend call is bounded by a timeout', async () => {
  const calls = mockResend();
  const ip = freshIp();
  await call(contact, makeReq(ip, 'POST', { ...fields, formToken: await agedToken(ip) }));
  assert.ok(calls[0].opts.signal instanceof AbortSignal);
});
