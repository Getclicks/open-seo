import { z } from "zod";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

/**
 * Search Console through a Google service account: a robot account added as
 * a user on each property, so the server needs no person's sign-in and no
 * refresh token that expires. The key is the JSON file Google Cloud
 * downloads, stored whole in GOOGLE_SERVICE_ACCOUNT_JSON.
 */

/** Stands in for an OAuth account id wherever a grant is picked. */
export const SERVICE_ACCOUNT_ID = "service-account";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const keySchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
  token_uri: z.url().default("https://oauth2.googleapis.com/token"),
});

type ServiceAccountKey = z.infer<typeof keySchema>;

export async function getServiceAccountKey(): Promise<ServiceAccountKey | null> {
  const raw = await getOptionalEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const parsed = keySchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Falls through to the log below.
  }
  console.error(
    "GOOGLE_SERVICE_ACCOUNT_JSON is not a service account key file",
  );
  return null;
}

export async function getServiceAccountEmail(): Promise<string | null> {
  return (await getServiceAccountKey())?.client_email ?? null;
}

function base64Url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function pemToDer(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

// Tokens live an hour; reuse one per isolate until shortly before expiry.
let cached: { token: string; expiresAt: number } | null = null;

/** An access token for Search Console, from a signed JWT (RFC 7523). */
export async function getServiceAccountAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const key = await getServiceAccountKey();
  if (!key) throw new Error("No Google service account is configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: key.client_email,
      scope: GSC_SCOPE,
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(key.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${base64Url(signature)}`;
  const response = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google refused the service account (${response.status}): ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = z
    .object({ access_token: z.string(), expires_in: z.number() })
    .parse(await response.json());
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}
