import fs from "node:fs";
import path from "node:path";

function findRepoRoot(cwd: string): string {
    let current = path.resolve(cwd);
    while (true) {
        if (
            fs.existsSync(path.join(current, "pnpm-workspace.yaml")) ||
            fs.existsSync(path.join(current, "turbo.json"))
        ) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return path.resolve(cwd);
}

function dashboardDistCandidates(cwd: string): string[] {
    const candidates: string[] = [];
    const repoRoot = findRepoRoot(cwd);

    candidates.push(path.join(repoRoot, "frontend/dist"));
    candidates.push(path.resolve(cwd, "../frontend/dist"));
    candidates.push(path.join(repoRoot, "apps/web/dist"));
    candidates.push(path.resolve(cwd, "../web/dist"));
    candidates.push(path.resolve(cwd, "apps/web/dist"));
    candidates.push(path.resolve(cwd, "dist"));

    let current = path.resolve(cwd);
    while (true) {
        candidates.push(path.join(current, "apps/web/dist"));
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    return [...new Set(candidates.map((c) => path.resolve(c)))];
}

export function resolveWebDistPath(
    cwd = process.cwd(),
    configuredPath = process.env.WEB_DIST_PATH
): string {
    if (configuredPath) return path.resolve(cwd, configuredPath);

    const candidates = dashboardDistCandidates(cwd);
    const existing = candidates.find((candidate) =>
        fs.existsSync(path.join(candidate, "index.html"))
    );
    if (existing) return existing;

    const repoRoot = findRepoRoot(cwd);
    return path.join(repoRoot, "apps/web/dist");
}
