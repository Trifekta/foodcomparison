/**
 * Minimal types for http_ece, which ships none.
 *
 * It is a test-only dependency and exactly one function of it is used: the
 * second opinion on whether a browser can open what we encrypted. Declared to
 * the shape that call needs rather than to the library's whole surface.
 */
declare module "http_ece" {
  import type { ECDH } from "node:crypto";

  interface DecryptParams {
    version: "aes128gcm" | "aesgcm";
    privateKey: ECDH;
    authSecret: Buffer;
  }

  export function decrypt(buffer: Buffer, params: DecryptParams): Buffer;

  const ece: { decrypt: typeof decrypt };
  export default ece;
}
