// Publishes the shared LLM registry -- `docs/llm-registry/README.md` -- to
// the site:
// `node extra-work/local-llm/s3-push-llm-registry.mjs <info.json> [--dry-run]`.
//
// The site is the release bucket's `www/` prefix (`s3-push-release.js` writes
// `www/download/...`), so the file lands at `www/llm/info.json` and is served
// as https://www.openworship.app/llm/info.json. Credentials come from
// `extra-work/.env` (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
// AWS_BUCKET_NAME, AWS_DISTRIBUTION_ID), the same file `release.sh` reads;
// a variable already in the environment wins over the file.
//
// The file is checked the way the APP checks it before anything is sent: a
// registry the app would ignore must not be published. `--dry-run` checks and
// names the key, and sends nothing.
//
// `llm-tunnel.mjs --publish` and `llm-registry.mjs` use the two doors below:
// `readPublishedRegistry` (what the bucket holds NOW, not what the CDN last
// served) and `publishRegistry`.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OBJECT_KEY = 'www/llm/info.json';
const INVALIDATION_PATH = '/llm/info.json';
export const PUBLIC_URL = 'https://www.openworship.app/llm/info.json';
const MAX_SERVERS = 20;
const ID_PATTERN = /^[A-Za-z0-9-]{1,48}$/;

function readEnvFile(filePath) {
    let text;
    try {
        text = readFileSync(filePath, 'utf-8');
    } catch (_error) {
        return {};
    }
    const env = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }
        const index = line.indexOf('=');
        if (index <= 0) {
            continue;
        }
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

/**
 * The app's own rules, in short: version 1, a `servers` list, each with a
 * slug id, a name, an http(s) address and at least one model id -- or, in
 * place of the models, `isAcceptingReport: true`: an address that takes the
 * app's problem reports and is no assistant. Answers the problems found,
 * empty when the file is good.
 */
// The app's own reading of a `note` (`toRegistryNote` in
// electron/customLlmProtocol.ts): text, or language code → text.
const NOTE_MAX = 300;
const MAX_NOTE_LANGS = 12;
const NOTE_LANG_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

/** What is wrong with a note the app would show cut or not at all, or null. */
export function findNoteProblem(note) {
    if (note === undefined) {
        return null;
    }
    if (typeof note === 'string') {
        return note.trim().length > NOTE_MAX
            ? `is over ${NOTE_MAX} characters: the app cuts it`
            : null;
    }
    if (note === null || typeof note !== 'object' || Array.isArray(note)) {
        return 'must be text, or an object of language code to text';
    }
    const entries = Object.entries(note);
    if (entries.length > MAX_NOTE_LANGS) {
        return `has more than ${MAX_NOTE_LANGS} languages: the app keeps the first ${MAX_NOTE_LANGS}`;
    }
    for (const [langCode, text] of entries) {
        if (!NOTE_LANG_PATTERN.test(langCode)) {
            return `"${langCode}" is not a language code (km, fr, pt-BR)`;
        }
        if (typeof text !== 'string' || text.trim().length === 0) {
            return `"${langCode}" must be text`;
        }
        if (text.trim().length > NOTE_MAX) {
            return `"${langCode}" is over ${NOTE_MAX} characters: the app cuts it`;
        }
    }
    return null;
}

export function findRegistryProblems(data) {
    const problems = [];
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return ['the file is not a JSON object'];
    }
    if (data.version !== 1) {
        problems.push('"version" must be 1');
    }
    if (!Array.isArray(data.servers)) {
        problems.push('"servers" must be a list');
        return problems;
    }
    if (data.servers.length > MAX_SERVERS) {
        problems.push(
            `more than ${MAX_SERVERS} servers: the app keeps the first ${MAX_SERVERS}`,
        );
    }
    const seen = new Set();
    data.servers.forEach((server, index) => {
        const where = `servers[${index}]`;
        if (server === null || typeof server !== 'object') {
            problems.push(`${where} is not an object`);
            return;
        }
        if (typeof server.id !== 'string' || !ID_PATTERN.test(server.id)) {
            problems.push(`${where}.id must match ${ID_PATTERN}`);
        } else if (seen.has(server.id)) {
            problems.push(`${where}.id "${server.id}" is used twice`);
        } else {
            seen.add(server.id);
        }
        if (
            typeof server.name !== 'string' ||
            server.name.trim().length === 0
        ) {
            problems.push(`${where}.name is missing`);
        }
        if (
            typeof server.baseUrl !== 'string' ||
            !/^https?:\/\//.test(server.baseUrl.trim())
        ) {
            problems.push(`${where}.baseUrl must be an http(s) address`);
        }
        const noteProblem = findNoteProblem(server.note);
        if (noteProblem !== null) {
            problems.push(`${where}.note ${noteProblem}`);
        }
        if (server.isAcceptingReport === true) {
            // The app posts the report to this address exactly as written,
            // and refuses one it cannot write that way.
            if (/[?#]/.test(String(server.baseUrl ?? ''))) {
                problems.push(
                    `${where}.baseUrl takes reports and must carry no "?" or "#"`,
                );
            }
            // Only that: it needs no models. With models on it the same
            // address is an assistant too, held to the rule below.
            if (!Array.isArray(server.models) || server.models.length === 0) {
                return;
            }
        }
        const models = Array.isArray(server.models) ? server.models : [];
        if (
            models.filter((model) => {
                return (
                    typeof model?.model === 'string' &&
                    model.model.trim().length > 0
                );
            }).length === 0
        ) {
            problems.push(`${where}.models must name at least one model`);
        }
        models.forEach((model, modelIndex) => {
            const modelNoteProblem = findNoteProblem(model?.note);
            if (modelNoteProblem !== null) {
                problems.push(
                    `${where}.models[${modelIndex}].note ${modelNoteProblem}`,
                );
            }
        });
    });
    return problems;
}

// The release credentials (`extra-work/.env`, the environment winning), or
// the sentence that says which one is missing.
function readAwsSettings() {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const env = { ...readEnvFile(resolve(here, '..', '.env')), ...process.env };
    for (const name of [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_REGION',
        'AWS_BUCKET_NAME',
        'AWS_DISTRIBUTION_ID',
    ]) {
        if (!env[name]) {
            throw new Error(`Missing ${name} (extra-work/.env)`);
        }
    }
    return {
        env,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
    };
}

/**
 * The registry as the bucket holds it this moment -- not as the CDN last
 * served it, which can be a minute old: two tunnels starting together must
 * each see the other's entry. None there, or one that is not JSON, is an
 * empty registry.
 */
export async function readPublishedRegistry() {
    const { env, credentials } = readAwsSettings();
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: env.AWS_REGION, credentials });
    let text;
    try {
        const output = await s3.send(
            new GetObjectCommand({
                Bucket: env.AWS_BUCKET_NAME,
                Key: OBJECT_KEY,
            }),
        );
        text = await output.Body.transformToString();
    } catch (error) {
        if (
            error?.name === 'NoSuchKey' ||
            error?.$metadata?.httpStatusCode === 404
        ) {
            return { version: 1, servers: [] };
        }
        throw error;
    }
    try {
        const data = JSON.parse(text);
        return Array.isArray(data?.servers)
            ? data
            : { version: 1, servers: [] };
    } catch (_error) {
        return { version: 1, servers: [] };
    }
}

/**
 * The registry as the site is sent it: without the `$schema` line a file
 * kept by hand may open with for its editor (`llm-info.schema.json`) -- a
 * path beside that file, which names nothing on the site.
 */
export function toPublishedRegistry(data) {
    const { $schema: _schema, ...published } = data;
    return published;
}

/**
 * Checks `data` the way the app does, writes it to the site and clears the
 * CDN's copy. Throws with a sentence to show when it cannot: a registry the
 * app would ignore, a missing credential, or the AWS packages not installed
 * (a copy of this folder outside the repo checkout).
 */
export async function publishRegistry(data, log = console.log) {
    const problems = findRegistryProblems(data);
    if (problems.length > 0) {
        throw new Error(
            `The registry would be ignored by the app: ${problems.join('; ')}`,
        );
    }
    const { env, credentials } = readAwsSettings();
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { CloudFrontClient, CreateInvalidationCommand } =
        await import('@aws-sdk/client-cloudfront');
    const s3 = new S3Client({ region: env.AWS_REGION, credentials });
    await s3.send(
        new PutObjectCommand({
            Bucket: env.AWS_BUCKET_NAME,
            Key: OBJECT_KEY,
            Body: JSON.stringify(toPublishedRegistry(data), null, 2) + '\n',
            ContentType: 'application/json; charset=utf-8',
            // A Reload in the app should see a change within a minute.
            CacheControl: 'max-age=60',
        }),
    );
    log(`Uploaded ${OBJECT_KEY} to ${env.AWS_BUCKET_NAME}`);
    const cloudFront = new CloudFrontClient({
        region: env.AWS_REGION,
        credentials,
    });
    await cloudFront.send(
        new CreateInvalidationCommand({
            DistributionId: env.AWS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: `llm-registry-${Date.now()}`,
                Paths: { Quantity: 1, Items: [INVALIDATION_PATH] },
            },
        }),
    );
    log(`Invalidated ${INVALIDATION_PATH} on ${env.AWS_DISTRIBUTION_ID}`);
}

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const filePath = args.find((arg) => !arg.startsWith('--'));
    if (!filePath) {
        console.error(
            'Usage: node extra-work/local-llm/s3-push-llm-registry.mjs <info.json> [--dry-run]',
        );
        process.exit(2);
    }
    const text = readFileSync(resolve(filePath), 'utf-8');
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        console.error(`Not JSON: ${error.message}`);
        process.exit(1);
    }
    const problems = findRegistryProblems(data);
    if (problems.length > 0) {
        console.error('The registry would be ignored by the app:');
        for (const problem of problems) {
            console.error(`  - ${problem}`);
        }
        process.exit(1);
    }
    console.log(
        `Registry OK: ${data.servers.length} server(s) -> s3://<bucket>/${OBJECT_KEY} (${PUBLIC_URL})`,
    );
    if (isDryRun) {
        console.log('Dry run: nothing sent.');
        return;
    }
    await publishRegistry(data);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main().catch((error) => {
        console.error(error?.message ?? error);
        process.exit(1);
    });
}
