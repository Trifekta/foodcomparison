/**
 * Web Push, on Web Crypto.
 *
 * The usual answer is the `web-push` package, and it is the wrong one here: it
 * reaches for Node's `https` module and Node's crypto bindings, and this app
 * runs on a Cloudflare Worker. Everything the protocol needs - ECDH on P-256,
 * HKDF, AES-GCM, ECDSA signing - is in the Web Crypto standard that Workers
 * implement natively, so the protocol is implemented directly rather than
 * shimmed around.
 *
 * Two specifications are at work:
 *
 *  - RFC 8292 (VAPID): a short-lived ES256 JWT proving the sender is us. It is
 *    what stops anybody who learns a browser's endpoint from pushing to it.
 *  - RFC 8291 (aes128gcm): the payload, encrypted to a key only that browser
 *    holds. The push service forwards it without being able to read it, which
 *    is why the customer's saving can be in the message at all.
 *
 * None of this touches the private key outside the server: it is read from the
 * environment, imported into a non-extractable CryptoKey, and used to sign.
 */

const encoder = new TextEncoder();

/** base64url, without padding, which is what every field in these RFCs uses. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** A P-256 public key as the 65-byte uncompressed point these RFCs exchange. */
async function exportPublicPoint(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

/**
 * The VAPID keypair, from the two environment values.
 *
 * The public key is the 65-byte point; the private key is the 32-byte scalar.
 * That is exactly what `web-push generate-vapid-keys` prints, so keys made with
 * the standard tool work here unchanged - worth keeping, because the generation
 * step is the one part of this a person does by hand.
 *
 * Web Crypto will not import a bare scalar, so the two are recombined into the
 * JWK it does accept. The coordinates come from the public point rather than
 * being recomputed, which is why both values are required.
 */
export async function importVapidKey(
  publicKey: string,
  privateKey: string,
): Promise<CryptoKey> {
  const point = fromBase64Url(publicKey);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error("WEB_PUSH_PUBLIC_KEY is not an uncompressed P-256 point");
  }

  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(point.slice(1, 33)),
    y: toBase64Url(point.slice(33, 65)),
    d: privateKey.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  };

  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

/**
 * The Authorization header for one push.
 *
 * Scoped to the push service's own origin and expiring in twelve hours: a token
 * that named the endpoint would have to be minted per subscription, and one
 * that never expired would be a permanent key to push to our subscribers if it
 * ever leaked from a log.
 */
export async function vapidAuthorization(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );

  const signingInput = `${header}.${claims}`;
  const key = await importVapidKey(publicKey, privateKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)),
  );

  return `vapid t=${signingInput}.${toBase64Url(signature)}, k=${publicKey}`;
}

/** HKDF as RFC 8291 uses it: SHA-256, a salt, and a one-byte-counter info. */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export interface EncryptedPush {
  body: Uint8Array;
}

/**
 * Encrypts a payload for one subscription, per RFC 8291.
 *
 * The shape of it: a throwaway keypair is made for this single message, ECDH
 * against the browser's public key produces a shared secret, and that plus the
 * subscription's auth secret is stretched by HKDF into a content key and a
 * nonce. The plaintext is padded with the 0x02 delimiter the spec requires and
 * sealed with AES-GCM. The result carries its own salt and the throwaway public
 * key in the header, which is how the browser can derive the same key and
 * nobody else can.
 */
export async function encryptPayload(
  payload: string,
  p256dh: string,
  authSecret: string,
): Promise<EncryptedPush> {
  const clientPublic = fromBase64Url(p256dh);
  const auth = fromBase64Url(authSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const ephemeralPublic = await exportPublicPoint(ephemeral.publicKey);

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256),
  );

  // "WebPush: info" || 0x00 || client public || server public
  const keyInfo = concat(
    encoder.encode("WebPush: info"),
    new Uint8Array([0]),
    clientPublic,
    ephemeralPublic,
  );
  const ikm = await hkdf(auth, sharedSecret, keyInfo, 32);

  const contentEncryptionKey = await hkdf(
    salt,
    ikm,
    concat(encoder.encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    concat(encoder.encode("Content-Encoding: nonce"), new Uint8Array([0, 1])),
    12,
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // 0x02 marks the last record. Without it the browser rejects the message.
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      plaintext as BufferSource,
    ),
  );

  // salt(16) || record size(4) || key length(1) || server public key || body
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  return {
    body: concat(
      salt,
      recordSize,
      new Uint8Array([ephemeralPublic.length]),
      ephemeralPublic,
      ciphertext,
    ),
  };
}
