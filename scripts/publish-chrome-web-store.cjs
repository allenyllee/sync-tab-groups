const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const scope = 'https://www.googleapis.com/auth/chromewebstore';
const apiRoot = 'https://chromewebstore.googleapis.com';

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createJwtAssertion(credentials, now = Math.floor(Date.now() / 1000)) {
  assert.ok(credentials.client_email, 'Service account client_email is missing');
  assert.ok(credentials.private_key, 'Service account private_key is missing');
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64Url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), {
    key: credentials.private_key,
  });
  return `${unsigned}.${base64Url(signature)}`;
}

async function fetchJson(url, options, fetchImplementation = fetch) {
  const response = await fetchImplementation(url, options);
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = {rawResponse: body};
  }
  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} failed (${response.status}): `
        + JSON.stringify(parsed),
    );
  }
  return parsed;
}

function readConfiguration(environment = process.env) {
  assert.ok(
    environment.CWS_SERVICE_ACCOUNT_JSON,
    'Missing CWS_SERVICE_ACCOUNT_JSON secret',
  );
  assert.match(
    environment.CWS_PUBLISHER_ID || '',
    /^[A-Za-z0-9._-]+$/,
    'Missing or invalid CWS_PUBLISHER_ID variable',
  );
  assert.match(
    environment.CWS_ITEM_ID || '',
    /^[a-p]{32}$/,
    'Missing or invalid CWS_ITEM_ID',
  );

  const packagePath = path.resolve(
    environment.CWS_PACKAGE_PATH
      || 'release/tab-groups-resurrection-chrome.zip',
  );
  assert.ok(fs.existsSync(packagePath), `Package not found: ${packagePath}`);

  let credentials;
  try {
    credentials = JSON.parse(environment.CWS_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('CWS_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  return {
    credentials,
    itemId: environment.CWS_ITEM_ID,
    packagePath,
    publisherId: environment.CWS_PUBLISHER_ID,
  };
}

async function obtainAccessToken(credentials, fetchImplementation = fetch) {
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const assertion = createJwtAssertion(credentials);
  const body = new URLSearchParams({
    assertion,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
  });
  const result = await fetchJson(tokenUri, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body,
  }, fetchImplementation);
  assert.ok(result.access_token, 'Google token response had no access_token');
  return result.access_token;
}

function authorizationHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

async function waitForUpload(
  resourceName,
  accessToken,
  fetchImplementation = fetch,
) {
  const statusUrl = `${apiRoot}/v2/${resourceName}:fetchStatus`;
  for (let attempt = 0; attempt < 24; attempt++) {
    const status = await fetchJson(statusUrl, {
      headers: authorizationHeaders(accessToken),
    }, fetchImplementation);
    if (status.lastAsyncUploadState === 'SUCCEEDED') return status;
    if (status.lastAsyncUploadState === 'FAILED') {
      throw new Error('Chrome Web Store package processing failed');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Timed out waiting for Chrome Web Store package processing');
}

async function publish(configuration, fetchImplementation = fetch) {
  const {
    credentials,
    itemId,
    packagePath,
    publisherId,
  } = configuration;
  const accessToken = await obtainAccessToken(
    credentials,
    fetchImplementation,
  );
  const resourceName = `publishers/${publisherId}/items/${itemId}`;
  const packageName = path.basename(packagePath);
  const upload = await fetchJson(
    `${apiRoot}/upload/v2/${resourceName}:upload`,
    {
      method: 'POST',
      headers: authorizationHeaders(accessToken, {
        'Content-Type': 'application/zip',
        'X-Goog-Upload-File-Name': packageName,
        'X-Goog-Upload-Protocol': 'raw',
      }),
      body: fs.readFileSync(packagePath),
    },
    fetchImplementation,
  );

  if (upload.uploadState === 'FAILED') {
    throw new Error('Chrome Web Store rejected the uploaded package');
  }
  if (upload.uploadState === 'IN_PROGRESS') {
    await waitForUpload(resourceName, accessToken, fetchImplementation);
  } else {
    assert.equal(
      upload.uploadState,
      'SUCCEEDED',
      `Unexpected upload state: ${upload.uploadState}`,
    );
  }

  const submission = await fetchJson(
    `${apiRoot}/v2/${resourceName}:publish`,
    {
      method: 'POST',
      headers: authorizationHeaders(accessToken, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        publishType: 'DEFAULT_PUBLISH',
        skipReview: false,
        blockOnWarnings: true,
      }),
    },
    fetchImplementation,
  );

  assert.ok(
    !['REJECTED', 'CANCELLED'].includes(submission.state),
    `Chrome Web Store submission ended in ${submission.state}`,
  );
  console.log(JSON.stringify({
    itemId,
    uploadedVersion: upload.crxVersion,
    uploadState: upload.uploadState,
    submissionState: submission.state,
    publishType: 'DEFAULT_PUBLISH',
  }, null, 2));
  return {submission, upload};
}

async function run() {
  await publish(readConfiguration());
}

if (require.main === module) {
  run().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  createJwtAssertion,
  fetchJson,
  obtainAccessToken,
  publish,
  readConfiguration,
};
