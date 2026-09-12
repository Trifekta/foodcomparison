import { describe, expect, it } from "vitest";
import {
  encryptPayload,
  fromBase64Url,
  importVapidKey,
  toBase64Url,
  vapidAuthorization,
} from "@/lib/push/crypto";

/**
 * The parts of Web Push that can be checked without a push service.
 *
 * Delivery itself cannot be tested here - it needs a real browser endpoint at
 * Google or Mozilla - so what is tested is everything that decides whether the
 * bytes we send are the bytes the spec describes: the encodings, the JWT the
 * push service checks before it will forward anything, and the shape of the
 * encrypted body the browser has to be able to open.
 */

/** A real VAPID pair, generated for this test alone. */
const PUBLIC_KEY =
  "BFLRUA4dlP1a14_2OssrLrsi2kpLrvqt4SY721dehYP4OjrSzWhpyBQWx2e6-bU1pvdwuSURv9eZSrd4NyEvm9k";
const PRIVATE_KEY = "R46BRcNrO1v39t9m7HbwSnA_OuZZ5lYlNOIjEqbmyz4";

describe("base64url, which every field in these RFCs uses", () => {
  it("round-trips bytes without padding", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain("=");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(Array.from(fromBase64Url(encoded))).toEqual(Array.from(bytes));
  });

  it("decodes a value that was written without padding", () => {
    expect(fromBase64Url(toBase64Url(new Uint8Array([1, 2, 3])))).toHaveLength(3);
  });
});

describe("the VAPID key", () => {
  it("imports a standard web-push keypair", async () => {
    await expect(importVapidKey(PUBLIC_KEY, PRIVATE_KEY)).resolves.toBeDefined();
  });

  /** A truncated or compressed point would fail later, inside a fetch. */
  it("refuses a public key that is not an uncompressed P-256 point", async () => {
    await expect(importVapidKey(toBase64Url(new Uint8Array(64)), PRIVATE_KEY)).rejects.toThrow(
      /uncompressed P-256 point/,
    );
  });
});

describe("the Authorization header a push service checks", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";

  it("is a vapid header carrying a three-part JWT and the public key", async () => {
    const header = await vapidAuthorization(endpoint, PUBLIC_KEY, PRIVATE_KEY, "mailto:a@b.co");

    expect(header.startsWith("vapid t=")).toBe(true);
    expect(header).toContain(`k=${PUBLIC_KEY}`);

    const jwt = header.slice("vapid t=".length, header.indexOf(", k="));
    expect(jwt.split(".")).toHaveLength(3);
  });

  /**
   * The audience is the push service's origin, not the endpoint. A token
   * scoped to the full endpoint would have to be minted per subscription.
   */
  it("is scoped to the push service origin and expires", async () => {
    const header = await vapidAuthorization(endpoint, PUBLIC_KEY, PRIVATE_KEY, "mailto:a@b.co");
    const jwt = header.slice("vapid t=".length, header.indexOf(", k="));
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(jwt.split(".")[1])));

    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:a@b.co");
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    // Twelve hours, give or take the second this test took to run.
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 12 * 60 * 60);
  });

  it("signs with ES256, which is the only algorithm the spec allows", async () => {
    const header = await vapidAuthorization(endpoint, PUBLIC_KEY, PRIVATE_KEY, "mailto:a@b.co");
    const jwt = header.slice("vapid t=".length, header.indexOf(", k="));
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(jwt.split(".")[0])));

    expect(parsed).toEqual({ typ: "JWT", alg: "ES256" });
  });
});

describe("the encrypted body (RFC 8291)", () => {
  // A browser subscription's keys are a P-256 point and 16 random bytes.
  async function browserKeys() {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    return {
      p256dh: toBase64Url(raw),
      auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
    };
  }

  it("puts the salt, record size and sender key in the header the browser reads", async () => {
    const keys = await browserKeys();
    const { body } = await encryptPayload("hello", keys.p256dh, keys.auth);

    // salt(16) + record size(4) + key length(1) + key(65) = 86 bytes of header.
    expect(body.length).toBeGreaterThan(86);
    expect(body[20]).toBe(65);

    const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
    expect(recordSize).toBe(4096);

    // The sender's key is an uncompressed point, like the browser's.
    expect(body[21]).toBe(0x04);
  });

  it("produces a different body every time, because the salt and key are fresh", async () => {
    const keys = await browserKeys();
    const first = await encryptPayload("hello", keys.p256dh, keys.auth);
    const second = await encryptPayload("hello", keys.p256dh, keys.auth);

    expect(toBase64Url(first.body)).not.toBe(toBase64Url(second.body));
  });

  /**
   * The ciphertext is the plaintext plus the 0x02 delimiter plus a 16-byte
   * GCM tag. Getting this length wrong is how a payload silently fails to
   * decrypt in the browser.
   */
  it("is exactly the plaintext, the delimiter and the auth tag", async () => {
    const keys = await browserKeys();
    const payload = JSON.stringify({ title: "Ready", body: "Tap to see", url: "/r/abc" });
    const { body } = await encryptPayload(payload, keys.p256dh, keys.auth);

    const headerLength = 16 + 4 + 1 + 65;
    expect(body.length - headerLength).toBe(payload.length + 1 + 16);
  });

  it("refuses a browser key that is not a point", async () => {
    await expect(
      encryptPayload("hello", toBase64Url(new Uint8Array(10)), toBase64Url(new Uint8Array(16))),
    ).rejects.toThrow();
  });
});

/**
 * The test that actually matters.
 *
 * Everything above checks the shape of the bytes. This one plays the browser:
 * it keeps the private half of the subscription keys, then runs RFC 8291
 * backwards - read the salt and sender key out of the header, ECDH, HKDF, and
 * open the AES-GCM record. If the plaintext comes back, a real browser can
 * read what we send, which is the one thing that cannot be checked by looking
 * at lengths.
 */
describe("a browser can actually open what we send", () => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  function concat(...parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
    const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
      "deriveBits",
    ]);
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
        key,
        length * 8,
      ),
    );
  }

  it("decrypts back to exactly the payload that went in", async () => {
    // The browser's own subscription keys, private half kept this time.
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const clientPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    const payload = JSON.stringify({
      title: "Your SnipSavor result is ready 🎉",
      body: "We checked your basket on Keeta. Tap to see the result.",
      url: "/r/0123456789abcdef0123456789abcdef",
    });

    const { body } = await encryptPayload(
      payload,
      toBase64Url(clientPublic),
      toBase64Url(authSecret),
    );

    // Unpack the header the way a browser does.
    const salt = body.slice(0, 16);
    const keyLength = body[20];
    const serverPublic = body.slice(21, 21 + keyLength);
    const ciphertext = body.slice(21 + keyLength);

    const serverKey = await crypto.subtle.importKey(
      "raw",
      serverPublic as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "ECDH", public: serverKey }, pair.privateKey, 256),
    );

    const ikm = await hkdf(
      authSecret,
      shared,
      concat(encoder.encode("WebPush: info"), new Uint8Array([0]), clientPublic, serverPublic),
      32,
    );
    const contentKey = await hkdf(
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
      contentKey as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource },
        aesKey,
        ciphertext as BufferSource,
      ),
    );

    // The trailing byte is the 0x02 record delimiter, not part of the message.
    expect(plaintext[plaintext.length - 1]).toBe(2);
    expect(decoder.decode(plaintext.slice(0, -1))).toBe(payload);
  });

  it("cannot be opened with the wrong subscription keys", async () => {
    const mine = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const theirs = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const theirPublic = new Uint8Array(await crypto.subtle.exportKey("raw", theirs.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    const { body } = await encryptPayload(
      "secret",
      toBase64Url(theirPublic),
      toBase64Url(authSecret),
    );

    // Same unpacking, but with the wrong private key: the shared secret differs,
    // so the derived key differs, and AES-GCM refuses rather than returning junk.
    const serverPublic = body.slice(21, 21 + body[20]);
    const serverKey = await crypto.subtle.importKey(
      "raw",
      serverPublic as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "ECDH", public: serverKey }, mine.privateKey, 256),
    );
    const ikm = await hkdf(
      authSecret,
      shared,
      concat(encoder.encode("WebPush: info"), new Uint8Array([0]), theirPublic, serverPublic),
      32,
    );
    const contentKey = await hkdf(
      body.slice(0, 16),
      ikm,
      concat(encoder.encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])),
      16,
    );
    const nonce = await hkdf(
      body.slice(0, 16),
      ikm,
      concat(encoder.encode("Content-Encoding: nonce"), new Uint8Array([0, 1])),
      12,
    );
    const aesKey = await crypto.subtle.importKey(
      "raw",
      contentKey as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource },
        aesKey,
        body.slice(21 + body[20]) as BufferSource,
      ),
    ).rejects.toThrow();
  });
});
