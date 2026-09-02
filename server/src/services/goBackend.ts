import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

let goBackendProcess: ChildProcess | null = null;

export function startGoBackend(): void {
    const binPath = path.resolve(process.cwd(), "../backend/gorouter-backend");
    if (!fs.existsSync(binPath)) {
        console.warn(`[GoBackend] Binary not found at ${binPath}, skipping embedded Go proxy start.`);
        return;
    }

    const dataDir = process.env.DATA_DIR || path.resolve(process.env.HOME || "/root", ".gorouter");
    const port = process.env.GO_PORT || "20130";

    console.log(`[GoBackend] Spawning 9router-go proxy engine on port ${port}...`);

    goBackendProcess = spawn(binPath, [], {
        cwd: path.dirname(binPath),
        env: {
            ...process.env,
            PORT: port,
            DATA_DIR: dataDir,
            RTK_ENABLED: process.env.RTK_ENABLED || "true"
        },
        stdio: "inherit"
    });

    goBackendProcess.on("exit", (code, signal) => {
        console.log(`[GoBackend] Go proxy process exited with code ${code}, signal ${signal}`);
        goBackendProcess = null;
    });

    process.on("exit", () => {
        if (goBackendProcess) {
            goBackendProcess.kill();
        }
    });
}
