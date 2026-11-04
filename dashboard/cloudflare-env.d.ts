declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DEVICE_TOKEN_SHA256?: string;
    AUTH_PEPPER?: string;
  }
}
