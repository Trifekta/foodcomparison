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
/**
 * There was a hand-rolled decryption test here, and it is gone on purpose.
 *
 * It unpacked the header and re-derived the keys - using the same wrong info
 * strings the implementation used. So it passed, every time, against a
 * ciphertext no browser could open. It was not a test of the spec; it was a
 * mirror, and a mirror always agrees.
 *
 * The replacement is below and decrypts with http_ece, which shares no code
 * with ours. That is the only version of this test worth having: the whole
 * value is in the second opinion.
 */

/**
 * One browser, two roles.
 *
 * The admin tests the customer flow on the phone they run the dashboard on, so
 * one browser holds both an admin registration and a customer one. Keyed on the
 * endpoint alone, the second overwrote the first: the admin was registered,
 * then silently was not, and the only symptom was a notification that never
 * arrived. Nothing errored at any point.
 *
 * The constant is asserted rather than the behaviour because the behaviour is a
 * Postgres unique constraint, and a test that mocked it would prove only that
 * the mock agreed with itself. What can go wrong in code is the two call sites
 * drifting apart, which is why they now read the same value.
 */
describe("what makes a subscription the same one", () => {
  it("is the endpoint and the role, never the endpoint alone", async () => {
    const { PUSH_CONFLICT_TARGET } = await import("@/lib/push/send");
    expect(PUSH_CONFLICT_TARGET).toBe("endpoint,kind");
  });
});

/**
 * The test that was missing, and the reason this file passed while every push
 * silently failed.
 *
 * Everything above checks the SHAPE of the encrypted body - the header layout,
 * the lengths, that the salt changes. All of it passed against an
 * implementation whose content key and nonce no browser on earth could
 * reproduce, because shape is not correctness and a test that encrypts with our
 * code and inspects it with our assumptions is a closed loop agreeing with
 * itself.
 *
 * So this decrypts, with http_ece - the library the real clients agree with,
 * and which shares no code with ours. If the two ever disagree about a spec
 * again, this fails instead of a customer's phone staying quiet.
 */
describe("what the browser actually receives", () => {
  it("decrypts to exactly what was sent, using an implementation that is not ours", async () => {
    const [{ default: ece }, nodeCrypto] = await Promise.all([
      import("http_ece"),
      import("node:crypto"),
    ]);

    // A browser's subscription keypair, made the way a real one is.
    const subscriber = nodeCrypto.createECDH("prime256v1");
    subscriber.generateKeys();
    const authSecret = nodeCrypto.randomBytes(16);

    const payload = JSON.stringify({
      title: "New SnipSavor request 🔔",
      body: "A customer in Dubai Marina just submitted a price comparison.",
      url: "/admin",
    });

    const { body } = await encryptPayload(
      payload,
      subscriber.getPublicKey().toString("base64url"),
      authSecret.toString("base64url"),
    );

    const decrypted = ece.decrypt(Buffer.from(body), {
      version: "aes128gcm",
      privateKey: subscriber,
      authSecret,
    });

    expect(decrypted.toString()).toBe(payload);
  });

  /**
   * The specific mistake, named so it cannot come back quietly: the HKDF info
   * strings end at their null terminator. crypto.subtle.deriveBits runs
   * HKDF-Expand itself and appends the 0x01 counter, so adding it by hand
   * derives a key the browser cannot reproduce - and nothing anywhere reports an
   * error. The push service accepts the message, delivers it, and the service
   * worker fails to open it in silence.
   */
  it("still decrypts a payload long enough to span the padding boundary", async () => {
    const [{ default: ece }, nodeCrypto] = await Promise.all([
      import("http_ece"),
      import("node:crypto"),
    ]);

    const subscriber = nodeCrypto.createECDH("prime256v1");
    subscriber.generateKeys();
    const authSecret = nodeCrypto.randomBytes(16);
    const payload = "x".repeat(2000);

    const { body } = await encryptPayload(
      payload,
      subscriber.getPublicKey().toString("base64url"),
      authSecret.toString("base64url"),
    );

    expect(
      ece
        .decrypt(Buffer.from(body), { version: "aes128gcm", privateKey: subscriber, authSecret })
        .toString(),
    ).toBe(payload);
  });
});
