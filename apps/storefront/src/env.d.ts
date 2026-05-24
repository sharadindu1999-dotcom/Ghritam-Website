/// <reference types="astro/client" />

/** Cloudflare bindings + environment variables available at the edge. */
interface CloudflareEnv {
  DB: import('@cloudflare/workers-types').D1Database;
  // Sync
  GITHUB_WEBHOOK_SECRET?: string;
  SYNC_SECRET?: string;
  KEYSTATIC_REPO?: string;
  GITHUB_TOKEN?: string;
  CONTENT_REF?: string;
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
  // Razorpay (Phase 3)
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;
}

type CloudflareRuntime = import('@astrojs/cloudflare').Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends CloudflareRuntime {}
}
