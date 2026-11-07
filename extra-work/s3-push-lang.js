'use strict';
/* eslint-disable */

// Publishes the language plugins (2026-11-04: every language but English is
// one) to the app's site, where Settings > Languages finds them:
//
//   www/lang/info.json                    the catalog, CUMULATIVE
//   www/lang/<code>/<code>-<version>.tar.gz  one pack per language version
//
// `node extra-work/build-lang-plugins.mjs --release` packs every language the
// catalog offers -- the built-in ones (their updates) and the online-only ones
// -- into extra-work/lang/release/; this uploads those packs and READ-MODIFY-
// WRITES the published catalog, the way `s3-push-release.js` does the
// extra-bin map: an older app finds the newest pack built for ITS
// `apiVersion`, so an entry is never dropped, and a failed read of the
// published catalog stops the release rather than orphaning every language
// already out there (memory `extra-bin-on-demand`).
//
// Same environment as `s3-push-release.js` (RELEASE_AWS_*), and
// `RELEASE_DRY_RUN=true` writes into `extra-work/fake-s3` instead.

const { execFileSync } = require('node:child_process');
const { createReadStream, createWriteStream, readFileSync } = require('node:fs');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const { pipeline } = require('node:stream/promises');
const {
    CloudFrontClient,
    CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');
const {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} = require('@aws-sdk/client-s3');

const { homepage } = require('../package.json');

const instanceInitData = {
    apiVersion: 'latest',
    region: process.env.RELEASE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.RELEASE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.RELEASE_AWS_SECRET_ACCESS_KEY,
    },
};

const PUBLIC_KEY_PREFIX = 'lang';
const BASE_KEY_PREFIX = `www/${PUBLIC_KEY_PREFIX}`;
const CATALOG_KEY = `${BASE_KEY_PREFIX}/info.json`;
const RELEASE_DIR = resolve(__dirname, 'lang', 'release');

const isDryRun = process.env.RELEASE_DRY_RUN === 'true';
const fakeS3Dir = process.env.RELEASE_FAKE_S3_DIR
    ? resolve(process.env.RELEASE_FAKE_S3_DIR)
    : resolve(__dirname, 'fake-s3');

function genFakeS3FilePath(key) {
    return resolve(fakeS3Dir, ...key.split('/'));
}

async function upload(client, key, body, contentType) {
    if (isDryRun) {
        const filePath = genFakeS3FilePath(key);
        await mkdir(dirname(filePath), { recursive: true });
        if (typeof body === 'string') {
            await writeFile(filePath, body, 'utf-8');
        } else {
            await pipeline(body, createWriteStream(filePath));
        }
        console.log(`*Written to "${filePath}"`);
        return;
    }
    const bucketName = process.env.RELEASE_AWS_BUCKET_NAME;
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
    });
    for (let attempt = 1; ; attempt++) {
        try {
            await client.send(command);
            break;
        } catch (error) {
            if (attempt === 3) {
                throw error;
            }
        }
    }
    console.log(`*Uploaded to "s3://${bucketName}/${key}"`);
}

/**
 * The published catalog, read from S3 itself (strongly consistent, and never
 * the CDN's SPA-index HTML). A missing object is the first publish; anything
 * else stops the release.
 */
async function readRemoteCatalog(client) {
    if (isDryRun) {
        try {
            return JSON.parse(
                await readFile(genFakeS3FilePath(CATALOG_KEY), 'utf-8'),
            );
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    try {
        const output = await client.send(
            new GetObjectCommand({
                Bucket: process.env.RELEASE_AWS_BUCKET_NAME,
                Key: CATALOG_KEY,
            }),
        );
        return JSON.parse(await output.Body.transformToString());
    } catch (error) {
        if (
            error.name === 'NoSuchKey' ||
            error.$metadata?.httpStatusCode === 404
        ) {
            console.log(`No "${CATALOG_KEY}" yet: the first publish.`);
            return null;
        }
        throw error;
    }
}

// `mergeCatalogEntry` of build-lang-plugins.mjs, which is an ES module.
function mergeCatalogEntry(catalog, entry) {
    const next = { version: 1, languages: { ...(catalog?.languages ?? {}) } };
    const list = (next.languages[entry.langCode] ?? []).filter((item) => {
        return !(
            item.version === entry.version &&
            item.apiVersion === entry.apiVersion
        );
    });
    list.unshift(entry);
    next.languages[entry.langCode] = list;
    return next;
}

async function clearCache() {
    const item = `/${PUBLIC_KEY_PREFIX}/info.json`;
    if (isDryRun) {
        console.log(`Dry run: skipping cache clearing for "${item}"`);
        return;
    }
    const cloudfront = new CloudFrontClient(instanceInitData);
    await cloudfront.send(
        new CreateInvalidationCommand({
            DistributionId: process.env.RELEASE_AWS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: `caller-reference-${Date.now()}`,
                Paths: { Quantity: 1, Items: [item] },
            },
        }),
    );
    console.log('Clear cache done for', item);
}

async function main() {
    execFileSync(
        process.execPath,
        [resolve(__dirname, 'build-lang-plugins.mjs'), '--release'],
        { stdio: 'inherit' },
    );
    const localCatalog = JSON.parse(
        readFileSync(resolve(RELEASE_DIR, 'info.json'), 'utf-8'),
    );
    const client = isDryRun ? null : new S3Client(instanceInitData);
    let catalog = await readRemoteCatalog(client);
    for (const list of Object.values(localCatalog.languages ?? {})) {
        for (const entry of list) {
            const key = `${BASE_KEY_PREFIX}/${entry.langCode}/${entry.fileFullName}`;
            await upload(
                client,
                key,
                createReadStream(resolve(RELEASE_DIR, entry.fileFullName)),
                'application/gzip',
            );
            catalog = mergeCatalogEntry(catalog, {
                ...entry,
                url: `${homepage}/${PUBLIC_KEY_PREFIX}/${entry.langCode}/${entry.fileFullName}`,
            });
        }
    }
    await upload(
        client,
        CATALOG_KEY,
        JSON.stringify(catalog, null, 2),
        'application/json',
    );
    await clearCache();
}

const targetTitle = isDryRun ? `fake S3 "${fakeS3Dir}"` : 'S3';
console.log(`Pushing the language plugins to ${targetTitle}...`);
main()
    .then(() => {
        console.log(`Done pushing the language plugins to ${targetTitle}.`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`Error pushing the language plugins:`, error);
        process.exit(1);
    });
