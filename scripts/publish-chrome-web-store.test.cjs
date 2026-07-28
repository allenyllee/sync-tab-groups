const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const {
  createJwtAssertion,
  fetchJson,
  publish,
} = require('./publish-chrome-web-store.cjs');

test('service-account assertion has valid claims and signature', () => {
  const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const privateKeyPem = privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  });
  const assertion = createJwtAssertion({
    client_email: 'publisher@example.iam.gserviceaccount.com',
    private_key: privateKeyPem,
    token_uri: 'https://oauth2.googleapis.com/token',
  }, 1000);
  const [header, claims, signature] = assertion.split('.');
  const payload = JSON.parse(Buffer.from(claims, 'base64url'));

  assert.equal(payload.iss, 'publisher@example.iam.gserviceaccount.com');
  assert.equal(payload.scope,
    'https://www.googleapis.com/auth/chromewebstore');
  assert.equal(payload.iat, 1000);
  assert.equal(payload.exp, 4600);
  assert.equal(crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${header}.${claims}`),
    publicKey,
    Buffer.from(signature, 'base64url'),
  ), true);
});

test('API errors include the response details', async() => {
  const mockFetch = async() => ({
    ok: false,
    status: 400,
    text: async() => JSON.stringify({error: {message: 'invalid package'}}),
  });

  await assert.rejects(
    fetchJson('https://example.invalid/upload', {
      method: 'POST',
    }, mockFetch),
    /invalid package/,
  );
});

test('successful upload is submitted for automatic publishing', async() => {
  const {privateKey} = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const requests = [];
  const responses = [
    {access_token: 'test-access-token'},
    {
      itemId: 'bmjkpeefoomkdgodlecgdjjgdkoldofj',
      crxVersion: '1.0.0',
      uploadState: 'SUCCEEDED',
    },
    {
      itemId: 'bmjkpeefoomkdgodlecgdjjgdkoldofj',
      state: 'PENDING_REVIEW',
    },
  ];
  const mockFetch = async(url, options) => {
    requests.push({url, options});
    return {
      ok: true,
      status: 200,
      text: async() => JSON.stringify(responses.shift()),
    };
  };

  await publish({
    credentials: {
      client_email: 'publisher@example.iam.gserviceaccount.com',
      private_key: privateKey.export({format: 'pem', type: 'pkcs8'}),
      token_uri: 'https://oauth2.googleapis.com/token',
    },
    itemId: 'bmjkpeefoomkdgodlecgdjjgdkoldofj',
    packagePath: path.resolve(
      __dirname,
      '../release/tab-groups-resurrection-chrome.zip',
    ),
    publisherId: 'publisher123',
  }, mockFetch);

  assert.equal(requests.length, 3);
  assert.match(requests[1].url, /\/upload\/v2\/publishers\/publisher123\//);
  assert.equal(
    requests[1].options.headers['X-Goog-Upload-Protocol'],
    'raw',
  );
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    publishType: 'DEFAULT_PUBLISH',
    skipReview: false,
    blockOnWarnings: true,
  });
});
