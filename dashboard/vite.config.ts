import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

const deployment = process.env.MINEHOST_DEPLOY === "1";
const databaseId = process.env.MINEHOST_D1_ID;
const databaseName = process.env.MINEHOST_D1_NAME;
const bucketName = process.env.MINEHOST_R2_BUCKET;

if (deployment && (!databaseId || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(databaseId)
  || !databaseName)) {
  throw new Error("Set MINEHOST_D1_ID and MINEHOST_D1_NAME for deployment.");
}

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        name: "minehost-dashboard",
        main: "./worker/index.ts",
        compatibility_date: "2026-05-15",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [{
          binding: "DB",
          database_id: deployment ? databaseId! : "00000000-0000-4000-8000-000000000000",
          database_name: deployment ? databaseName! : "minehost-local",
          migrations_dir: "../../drizzle",
        }],
        ...(deployment && !bucketName ? {} : {
          r2_buckets: [{ binding: "BUCKET", bucket_name: deployment ? bucketName! : "minehost-local" }],
        }),
      },
    }),
  ],
});
