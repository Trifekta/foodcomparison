/**
 * Generates a VAPID keypair for Web Push.
 *
 * `npx web-push generate-vapid-keys` produces the same thing, and this exists
 * so the one manual step in setting push up does not need a package installed
 * for thirty seconds and then removed. It uses the same Web Crypto the server
 * does, so a key made here is a key the server can import.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Keep the private key in the environment and nowhere else. Anybody holding it
 * can push notifications to every subscriber SnipSavor has.
 */

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);

const publicPoint = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

const publicKey = Buffer.from(publicPoint).toString("base64url");

console.log("\nAdd these to .env.local, and to the Worker's secrets in production:\n");
console.log(`WEB_PUSH_PUBLIC_KEY=${publicKey}`);
console.log(`WEB_PUSH_PRIVATE_KEY=${jwk.d}`);
console.log("WEB_PUSH_SUBJECT=mailto:admin@snipsavor.com");
console.log(
  "\nThe public key is safe to publish - browsers receive it to subscribe.\n" +
    "The private key is a secret. Changing it later invalidates every existing\n" +
    "subscription, because a push service checks the signature against the key\n" +
    "the browser subscribed with.\n",
);
