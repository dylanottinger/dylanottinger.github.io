import { timingSafeEqual, createHash } from "crypto";

const MAX_SECRET_LENGTH = 512;

function hashSecret(value) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(actual, expected) {
  return timingSafeEqual(hashSecret(actual), hashSecret(expected));
}

export function verifyWebhookSecret(req, envName) {
  const expectedSecret = process.env[envName];

  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      error: `${envName} is not configured`,
    };
  }

  const providedSecret = req.headers.get("x-webhook-secret");

  if (!providedSecret || providedSecret.length > MAX_SECRET_LENGTH) {
    return {
      ok: false,
      status: 401,
      error: "Invalid webhook secret",
    };
  }

  if (!safeEqual(providedSecret, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid webhook secret",
    };
  }

  return { ok: true };
}
