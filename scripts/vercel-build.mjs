import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isProduction = process.env.VERCEL_ENV === "production";

if (isProduction) {
  // Push Convex functions/schema to prod, then build Next with injected URL.
  run("npx", ["convex", "deploy", "--cmd", "npm run build"]);
} else {
  // Preview/dev must not use a production CONVEX_DEPLOY_KEY.
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    console.error(
      "NEXT_PUBLIC_CONVEX_URL must be set for non-production Vercel builds."
    );
    process.exit(1);
  }
  run("npm", ["run", "build"]);
}
