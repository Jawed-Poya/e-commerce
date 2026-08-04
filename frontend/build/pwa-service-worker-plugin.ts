import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

interface PwaServiceWorkerOptions {
    cachePrefix: string;
}

/**
 * Minimal structural types used by the shared plugin.
 *
 * The plugin lives outside the web/admin package directories. Importing Vite
 * types from this shared folder makes Node-style module resolution search from
 * `frontend/build`, where no local `vite` package exists. A structural contract
 * keeps the plugin shared and remains compatible with Vite in both apps.
 */
interface ResolvedBuildConfig {
    root: string;
    build: {
        outDir: string;
    };
}

interface BuildPlugin {
    name: string;
    apply: "build";
    configResolved(resolved: ResolvedBuildConfig): void;
    closeBundle(): Promise<void>;
}

async function walk(directory: string, root = directory): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return walk(absolute, root);
            }
            return path.relative(root, absolute).replaceAll(path.sep, "/");
        }),
    );
    return files.flat();
}

/**
 * Injects every production asset into the custom service worker without adding
 * another PWA dependency. Normal development keeps service workers disabled;
 * explicit PWA development warms runtime modules, while production receives
 * a complete versioned application shell.
 */
export function pwaServiceWorkerPlugin({
    cachePrefix,
}: PwaServiceWorkerOptions): BuildPlugin {
    let config: ResolvedBuildConfig | null = null;

    return {
        name: "pharmacy-pwa-service-worker",
        apply: "build",
        configResolved(resolved: ResolvedBuildConfig) {
            config = resolved;
        },
        async closeBundle() {
            if (!config) {
                throw new Error(
                    "PWA service worker plugin was not initialized by Vite.",
                );
            }

            const outputDirectory = path.resolve(config.root, config.build.outDir);
            const workerPath = path.join(outputDirectory, "service-worker.js");

            try {
                await fs.access(workerPath);
            } catch {
                throw new Error(
                    `PWA service worker source was not copied to ${workerPath}. ` +
                    "Add public/service-worker.js before running the production build.",
                );
            }

            const worker = await fs.readFile(workerPath, "utf8");
            if (
                !worker.includes("const BUILD_PRECACHE = [];") ||
                !worker.includes("__BUILD_CACHE_VERSION__")
            ) {
                throw new Error(
                    "public/service-worker.js is missing the required PWA build placeholders.",
                );
            }

            const outputFiles = (await walk(outputDirectory))
                .filter(
                    (file) =>
                        file !== "service-worker.js" && !file.endsWith(".map"),
                )
                .sort();
            const files = outputFiles.map((file) => `/${file}`);
            const contentHash = createHash("sha256");
            for (const file of outputFiles) {
                contentHash.update(file);
                contentHash.update("\0");
                contentHash.update(
                    await fs.readFile(path.join(outputDirectory, file)),
                );
                contentHash.update("\0");
            }
            const fingerprint = contentHash.digest("hex").slice(0, 12);
            const generated = worker
                .replace(
                    "const BUILD_PRECACHE = [];",
                    `const BUILD_PRECACHE = ${JSON.stringify(files)};`,
                )
                .replace(
                    "__BUILD_CACHE_VERSION__",
                    `${cachePrefix}-${fingerprint}`,
                );
            await fs.writeFile(workerPath, generated, "utf8");
        },
    };
}
