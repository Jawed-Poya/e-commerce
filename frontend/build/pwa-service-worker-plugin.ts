import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

interface PwaServiceWorkerOptions {
    cachePrefix: string;
}

async function walk(directory: string, root = directory): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(absolute, root);
        return path.relative(root, absolute).replaceAll(path.sep, "/");
    }));
    return files.flat();
}

/**
 * Injects every production asset into the custom service worker without adding
 * another PWA dependency. Normal development keeps service workers disabled;
 * explicit PWA development warms runtime modules, while production receives
 * a complete versioned application shell.
 */
export function pwaServiceWorkerPlugin({ cachePrefix }: PwaServiceWorkerOptions): Plugin {
    let config: ResolvedConfig;

    return {
        name: "pharmacy-pwa-service-worker",
        apply: "build",
        configResolved(resolved) {
            config = resolved;
        },
        async closeBundle() {
            const outputDirectory = path.resolve(config.root, config.build.outDir);
            const workerPath = path.join(outputDirectory, "service-worker.js");
            const worker = await fs.readFile(workerPath, "utf8");
            const outputFiles = (await walk(outputDirectory))
                .filter((file) => file !== "service-worker.js" && !file.endsWith(".map"))
                .sort();
            const files = outputFiles.map((file) => `/${file}`);
            const contentHash = createHash("sha256");
            for (const file of outputFiles) {
                contentHash.update(file);
                contentHash.update("\0");
                contentHash.update(await fs.readFile(path.join(outputDirectory, file)));
                contentHash.update("\0");
            }
            const fingerprint = contentHash.digest("hex").slice(0, 12);
            const generated = worker
                .replace('const BUILD_PRECACHE = [];', `const BUILD_PRECACHE = ${JSON.stringify(files)};`)
                .replace('__BUILD_CACHE_VERSION__', `${cachePrefix}-${fingerprint}`);
            await fs.writeFile(workerPath, generated, "utf8");
        },
    };
}
