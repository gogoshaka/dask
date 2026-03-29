// End-to-end test for the GitHub OAuth Device Flow.
// Exercises the real OAuth endpoints — requires GITHUB_CLIENT_ID env var.
//
// Run:   GITHUB_CLIENT_ID=Iv1.abc123 node --test extension/test/e2e/device-flow-e2e.test.js
// Skip:  Automatically skipped if GITHUB_CLIENT_ID is not set.
//
// NOTE: This test starts the Device Flow and verifies the API responses,
// but it CANNOT complete authentication automatically — that requires a
// human to visit github.com/login/device and enter the code.
// The test validates:
//   1. POST /login/device/code returns valid device_code + user_code
//   2. POST /login/oauth/access_token returns "authorization_pending" (expected)
//   3. The response format matches what the extension expects

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

if (!CLIENT_ID) {
  console.log('⏭️  Skipping Device Flow E2E — set GITHUB_CLIENT_ID to enable');
  process.exit(0);
}

describe('E2E: OAuth Device Flow', () => {

  let deviceCode = null;
  let userCode = null;
  let verificationUri = null;
  let interval = null;

  it('POST /login/device/code returns device and user codes', async () => {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: 'public_repo',
      }),
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json();

    // Validate required fields
    assert.ok(data.device_code, 'should have device_code');
    assert.ok(data.user_code, 'should have user_code');
    assert.ok(data.verification_uri, 'should have verification_uri');
    assert.ok(data.expires_in > 0, 'should have positive expires_in');
    assert.ok(data.interval >= 0, 'should have interval');

    // user_code format: XXXX-XXXX
    assert.match(data.user_code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'user_code should be XXXX-XXXX format');

    // verification_uri should point to GitHub
    assert.ok(
      data.verification_uri.includes('github.com'),
      `verification_uri should contain github.com, got: ${data.verification_uri}`
    );

    deviceCode = data.device_code;
    userCode = data.user_code;
    verificationUri = data.verification_uri;
    interval = data.interval;

    console.log(`   device_code: ${deviceCode.slice(0, 8)}...`);
    console.log(`   user_code: ${userCode}`);
    console.log(`   verification_uri: ${verificationUri}`);
    console.log(`   expires_in: ${data.expires_in}s, interval: ${interval}s`);
  });

  it('POST /login/oauth/access_token returns authorization_pending before user authorizes', async () => {
    // This should always return "authorization_pending" because no human
    // has visited the verification URL and entered the code.
    assert.ok(deviceCode, 'device_code must be set from previous test');

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json();

    // Should NOT have an access_token (no one authorized it)
    assert.equal(data.access_token, undefined, 'should not have access_token yet');

    // Should have error = authorization_pending
    assert.equal(data.error, 'authorization_pending', `expected authorization_pending, got: ${data.error}`);

    console.log(`   error: ${data.error} (expected — no human authorized)`);
  });

  it('rejects invalid client_id with correct error', async () => {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'invalid_client_id_that_does_not_exist',
        scope: 'public_repo',
      }),
    });

    // GitHub returns an error for invalid client_id
    const data = await res.json();

    // Either a non-200 status or an error field in the response
    const isError = res.status !== 200 || data.error;
    assert.ok(isError, 'should reject invalid client_id');
    console.log(`   Rejected invalid client_id (status: ${res.status}, error: ${data.error || 'N/A'})`);
  });

  it('rejects invalid device_code with correct error', async () => {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: 'totally_bogus_device_code',
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await res.json();

    // Should NOT return an access_token
    assert.equal(data.access_token, undefined, 'should not return access_token for bogus device_code');

    // Should have an error (likely "bad_verification_code" or similar)
    assert.ok(data.error, `should have error field, got: ${JSON.stringify(data)}`);
    assert.notEqual(data.error, 'authorization_pending', 'should not be pending for bogus code');

    console.log(`   Rejected bogus device_code (error: ${data.error})`);
  });
});
