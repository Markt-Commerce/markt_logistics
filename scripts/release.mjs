#!/usr/bin/env node
/**
 * Release helpers: bump the app version, and announce a store release to
 * Firebase Remote Config so installed apps prompt for it (services/appUpdate.ts).
 *
 *   node scripts/release.mjs bump <major|minor|patch>
 *   node scripts/release.mjs announce [--platform android|ios|all]
 *                                     [--required | --soft]
 *                                     [--message "..."] [--dry-run]
 *
 * bump      Rewrites expo.version in app.config.js. Build numbers are not
 *           touched -- EAS owns those (appVersionSource: remote).
 *
 * announce  Sets <app>_latest_version_<platform> to the current version, which
 *           shows the dismissible prompt. Whether it also sets
 *           <app>_min_version_<platform> (the blocking screen):
 *             --required  always
 *             --soft      never
 *             default     only when the MAJOR version went up since the last
 *                         announced one -- "major update => forced update".
 *
 *           Run it AFTER the store has approved and published the build. Before
 *           then, the prompt sends people to a listing that has nothing newer.
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT, either the JSON itself or a path to
 * it (EAS "file" secrets arrive as a path). The service account needs the
 * "Firebase Remote Config Admin" role. Nothing else is installed for this --
 * the OAuth exchange is a signed JWT, which node:crypto does fine.
 */
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// --- Per-app settings ------------------------------------------------------
const APP_KEY = "logistics";
const FIREBASE_PROJECT_ID = "marktcommerce-8c2b3";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILE = join(ROOT, "app.config.js");
// app.config.js is code, not JSON: match the first `version: '...'`, the one
// directly under expo, and leave the rest of the file untouched.
const VERSION_RE = /(\bversion:\s*['"])([^'"]+)(['"])/;

function readVersion() {
  const m = readFileSync(VERSION_FILE, "utf8").match(VERSION_RE);
  if (!m) fail(`No version field found in ${VERSION_FILE}`);
  return m[2];
}

function writeVersion(version) {
  const raw = readFileSync(VERSION_FILE, "utf8");
  writeFileSync(VERSION_FILE, raw.replace(VERSION_RE, `$1${version}$3`));
}
// ---------------------------------------------------------------------------

const PLATFORMS = ["android", "ios"];

function parseVersion(v) {
  return String(v).split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
}

function compare(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function bump(part) {
  const [major, minor, patch] = parseVersion(readVersion());
  const next = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }[part];
  if (!next) fail("bump takes one of: major, minor, patch");
  const prev = readVersion();
  writeVersion(next);
  console.log(`version ${prev} -> ${next}`);
}

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) fail("FIREBASE_SERVICE_ACCOUNT is not set (JSON or a path to it)");
  return JSON.parse(raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8"));
}

async function accessToken(sa) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.remoteconfig",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) fail(`OAuth token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function announce() {
  const version = readVersion();
  const platformArg = arg("--platform") ?? "all";
  const platforms = platformArg === "all" ? PLATFORMS : [platformArg];
  if (!platforms.every((p) => PLATFORMS.includes(p))) {
    fail("--platform takes android, ios or all");
  }
  const forceRequired = process.argv.includes("--required");
  const forceSoft = process.argv.includes("--soft");
  const message = arg("--message");
  const dryRun = process.argv.includes("--dry-run");

  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/remoteConfig`;
  const token = await accessToken(serviceAccount());
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Accept-Encoding": "gzip" },
  });
  if (!res.ok) fail(`Reading Remote Config failed: ${res.status} ${await res.text()}`);
  // The ETag makes the publish conditional: markt shares this template,
  // and a release of one app must not silently undo the other's.
  const etag = res.headers.get("etag");
  const template = await res.json();
  template.parameters ??= {};

  const get = (key) => template.parameters[key]?.defaultValue?.value;
  const set = (key, value, description) => {
    console.log(`  ${key}: ${get(key) ?? "(unset)"} -> ${value}`);
    template.parameters[key] = {
      defaultValue: { value },
      valueType: "STRING",
      description,
    };
  };

  console.log(`Announcing ${APP_KEY} ${version}${dryRun ? " (dry run)" : ""}`);
  for (const platform of platforms) {
    const latestKey = `${APP_KEY}_latest_version_${platform}`;
    const minKey = `${APP_KEY}_min_version_${platform}`;
    const prevLatest = get(latestKey);

    if (prevLatest && compare(version, prevLatest) < 0) {
      fail(`${platform}: ${version} is older than the announced ${prevLatest}`);
    }
    const majorBump =
      prevLatest !== undefined &&
      parseVersion(version)[0] > parseVersion(prevLatest)[0];
    const required = forceRequired || (!forceSoft && majorBump);

    set(latestKey, version, `Newest ${platform} version in the store; older installs see a dismissible prompt.`);
    if (required) {
      set(minKey, version, `Oldest supported ${platform} version; older installs are blocked until they update.`);
    }
  }
  if (message !== undefined) {
    set(`${APP_KEY}_update_message`, message, "Body text for the update prompt. Empty uses the app's default.");
  }

  if (dryRun) return;

  delete template.version;
  const put = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; UTF-8",
      "If-Match": etag ?? "*",
    },
    body: JSON.stringify(template),
  });
  if (!put.ok) fail(`Publishing Remote Config failed: ${put.status} ${await put.text()}`);
  console.log("Published.");
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const [command, part] = process.argv.slice(2);
if (command === "bump") bump(part);
else if (command === "announce") await announce();
else fail("usage: release.mjs bump <major|minor|patch> | announce [--platform ...] [--required|--soft] [--message ...] [--dry-run]");
