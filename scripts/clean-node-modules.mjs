import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const targets = ["node_modules", "dist"];
let failed = false;

for (const target of targets) {
  const fullPath = resolve(process.cwd(), target);

  try {
    await rm(fullPath, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 500,
    });
    console.log(`Removed ${fullPath}`);
  } catch (error) {
    failed = true;
    console.error(`Could not remove ${fullPath}.`);
    console.error(error);
  }
}

if (failed) {
  console.error("\nA Windows process is still locking files in node_modules.");
  console.error(
    "Stop Vite/dev servers and all Node.js terminals, close Explorer windows opened inside the project, then run this command again.",
  );
  console.error("As a last resort, run: taskkill /F /IM node.exe");
  process.exit(1);
}
