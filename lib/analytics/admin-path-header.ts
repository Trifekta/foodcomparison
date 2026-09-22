/**
 * The request header proxy.ts uses to tell the application which admin path a
 * request was for.
 *
 * Its own module, and a deliberately small one, because proxy.ts is bundled and
 * may be deployed separately from the rest of the app - the Next docs are
 * explicit that proxy code should not lean on shared modules. A single string
 * constant is the one kind of sharing that costs nothing and is worth having:
 * the writer and the reader of a header agreeing on its name by import rather
 * than by both spelling it correctly.
 *
 * "x-", not a bare name, so it cannot collide with a standard header, and never
 * trusted as input: proxy.ts overwrites whatever a client sent under this name.
 */
export const ADMIN_PATH_HEADER = "x-admin-path";
