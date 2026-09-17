// services/config.ts
//
// Single source of truth for the backend endpoint, mirroring markt_mobile's
// services/config.ts so both apps are configured the same way.
//
// The URL was hardcoded to the *test* backend inside services/api.ts. A
// production build made from that source would have shipped pointing at test:
// riders' real deliveries and real earnings going to a staging database, with
// nothing in the app to show which one it was talking to.
//
// EXPO_PUBLIC_* values are inlined by Metro at build time. The fallback keeps
// local runs working without a .env file; production sets it in the EAS build
// profile.

const CONFIGURED = process.env.EXPO_PUBLIC_API_URL;

/** The placeholder eas.json's production profile carries. It is deliberately
 *  not a hostname: no production URL exists in either repo yet, and inventing
 *  one is how a release ships pointing at nothing. */
const UNSET = "SET_ME_BEFORE_RELEASE";

export const API_HOST =
  CONFIGURED && CONFIGURED !== UNSET
    ? CONFIGURED
    : "https://test.api.marktcommerce.com";

/** True when a build was made without setting the backend. Nothing here can
 *  guess the right URL, but the app can refuse to be quiet about it. */
export const API_URL_UNSET = CONFIGURED === UNSET;

/** Every endpoint in services/api.ts hangs off this. */
export const API_BASE_URL = `${API_HOST}/api/v1/deliveries`;

/** True when this build is talking to the test backend. The dashboard shows a
 *  badge when it is, so nobody spends an afternoon wondering why a real order
 *  never appears. */
export const IS_TEST_BACKEND = API_HOST.includes("test.");
