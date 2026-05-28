/**
 * Minimal AWS Signature V4 signer using Web Crypto — works in Cloudflare
 * Workers without pulling in the AWS SDK (~hundreds of KB) or any other dep.
 *
 * We only use this for SES `SendEmail`; if other AWS services are added later
 * the same signer handles them.
 */

const encoder = new TextEncoder();

/** Encode a string into a fresh `ArrayBuffer` (not the `ArrayBufferLike` that
 *  TextEncoder returns, which trips TS's strict `BufferSource` typing). */
function toArrayBuffer(input: string): ArrayBuffer {
  const u = encoder.encode(input);
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(input));
  return toHex(digest);
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(data));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SignRequestInput {
  method: 'GET' | 'POST';
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: string;
  contentType?: string;
}

export interface SignedRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body: string;
}

/**
 * Build a fetch-ready, SigV4-signed request for `input`. The returned headers
 * map already includes Authorization, x-amz-date, x-amz-content-sha256, host
 * and (if set) content-type.
 */
export async function signAwsRequest(input: SignRequestInput): Promise<SignedRequest> {
  const url = new URL(input.url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // yyyymmddThhmmssZ
  const dateStamp = amzDate.slice(0, 8); // yyyymmdd
  const body = input.body ?? '';
  const payloadHash = await sha256Hex(body);

  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  if (input.contentType) headers['content-type'] = input.contentType;

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders =
    sortedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = sortedHeaderNames.join(';');

  const canonicalRequest = [
    input.method,
    url.pathname || '/',
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(toArrayBuffer('AWS4' + input.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, input.region);
  const kService = await hmac(kRegion, input.service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: input.url, method: input.method, headers, body };
}
