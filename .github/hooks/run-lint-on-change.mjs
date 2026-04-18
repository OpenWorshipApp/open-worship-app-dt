import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EDITING_TOOLS = new Set([
    "apply_patch",
    "create_file",
    "editFiles",
    "edit_notebook_file",
    "replace_string_in_file",
    "vscode_renameSymbol"
]);

const CODE_RELEVANT_EXTENSIONS = new Set([
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".cjs",
    ".cts",
    ".go",
    ".h",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".mjs",
    ".mts",
    ".py",
    ".rs",
    ".scss",
    ".sh",
    ".sql",
    ".ts",
    ".tsx",
    ".vue",
    ".yaml",
    ".yml"
]);

function writeJson(payload) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function readStdin() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.on("data", (chunk) => chunks.push(chunk));
        process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        process.stdin.on("error", reject);
    });
}

function normalizePath(value) {
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }

    if (value.startsWith("file://")) {
        try {
            return fileURLToPath(value).replaceAll("\\", "/");
        } catch {
            return value;
        }
    }

    return value.replaceAll("\\", "/");
}

function collectToolInputPaths(value, paths) {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            collectToolInputPaths(entry, paths);
        }
        return;
    }

    if (typeof value !== "object") {
        return;
    }

    for (const key of ["filePath", "path"]) {
        const current = normalizePath(value[key]);
        if (current) {
            paths.push(current);
        }
    }

    const uriPath = normalizePath(value.uri);
    if (uriPath) {
        paths.push(uriPath);
    }

    for (const key of ["files", "filePaths"]) {
        const current = value[key];
        if (Array.isArray(current)) {
            for (const entry of current) {
                collectToolInputPaths(entry, paths);
            }
        }
    }
}

function extractPathsFromPatch(patchText) {
    if (typeof patchText !== "string") {
        return [];
    }

    const matches = patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+?)(?: -> .+)?$/gm);
    return Array.from(matches, (match) => normalizePath(match[1]?.trim())).filter(Boolean);
}

function uniq(values) {
    return [...new Set(values)];
}

function getChangedPaths(payload) {
    const input = payload.tool_input ?? {};
    const paths = [];

    collectToolInputPaths(input, paths);

    if (payload.tool_name === "apply_patch") {
        paths.push(...extractPathsFromPatch(input.input));
    }

    return uniq(paths);
}

function isCodeRelevantPath(filePath) {
    if (!filePath) {
        return true;
    }

    const normalized = filePath.toLowerCase();
    const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);

    if (
        fileName === "electron.tsconfig.json" ||
        fileName === "eslint.config.mjs" ||
        fileName === "package.json" ||
        fileName === "vite.config.ts" ||
        fileName === "vitest.config.ts" ||
        fileName === "vitest.electron.config.ts" ||
        fileName.startsWith("tsconfig")
    ) {
        return true;
    }

    const extensionIndex = fileName.lastIndexOf(".");
    if (extensionIndex === -1) {
        return false;
    }

    return CODE_RELEVANT_EXTENSIONS.has(fileName.slice(extensionIndex));
}

function shouldRunTest(payload) {
    if (!EDITING_TOOLS.has(payload.tool_name)) {
        return false;
    }

    const changedPaths = getChangedPaths(payload);
    return changedPaths.length === 0 || changedPaths.some(isCodeRelevantPath);
}

function formatFailureOutput(toolName, changedPaths, stdout, stderr, status) {
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    const truncatedOutput = output.length > 12000 ? output.slice(-12000) : output;
    const changedFiles = changedPaths.map((value) => `- ${value}`).join("\n");
    const changedFilesSection = changedFiles ? `Changed paths:\n${changedFiles}\n\n` : "";

    return {
        decision: "block",
        reason: "npm run test failed after a code edit",
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: `${changedFilesSection}npm run test failed after ${toolName}. Exit code: ${status ?? "unknown"}.\n\n${truncatedOutput || "The command exited with a non-zero status without producing output."}`
        }
    };
}

async function main() {
    let payload;

    try {
        const rawInput = await readStdin();
        payload = rawInput ? JSON.parse(rawInput) : {};
    } catch {
        writeJson({
            systemMessage: "test-on-change hook skipped because the hook payload could not be parsed."
        });
        return;
    }

    if (!shouldRunTest(payload)) {
        writeJson({ continue: true });
        return;
    }

    const changedPaths = getChangedPaths(payload);
    const result = spawnSync("npm", ["run", "test"], {
        cwd: payload.cwd || process.cwd(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        shell: process.platform === "win32"
    });

    if (result.error) {
        writeJson({
            decision: "block",
            reason: "npm run test could not be started after a code edit",
            hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext: `The test hook failed to start npm run test after ${payload.tool_name}: ${result.error.message}`
            }
        });
        return;
    }

    if (result.status !== 0) {
        writeJson(
            formatFailureOutput(
                payload.tool_name,
                changedPaths,
                result.stdout,
                result.stderr,
                result.status
            )
        );
        return;
    }

    writeJson({ continue: true });
}

await main();
