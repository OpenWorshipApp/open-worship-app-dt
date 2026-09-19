'use strict';
/* eslint-disable */

const {
    createReadStream,
    createWriteStream,
    existsSync,
    readFileSync,
    readdirSync,
} = require('node:fs');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
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

const instanceInitData = {
    apiVersion: 'latest',
    region: process.env.RELEASE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.RELEASE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.RELEASE_AWS_SECRET_ACCESS_KEY,
    },
};

const downloadInfo = require('./download-info.json');
const { homepage } = require('../package.json');
const { dirname, resolve } = require('node:path');

const PUBLIC_BASE_KEY_PREFIX = 'download';
const BASE_KEY_PREFIX = 'www/download';

// `npm run release:dry-run` sets this: everything runs as usual, but objects are
// written under `fakeS3Dir` instead of the bucket and no cache is invalidated.
const isDryRun = process.env.RELEASE_DRY_RUN === 'true';
// The directory stands in for the BUCKET ROOT, so an object lands at its
// verbatim S3 key. `RELEASE_FAKE_S3_DIR` is an override for testing; the release
// script leaves it unset.
const fakeS3Dir = process.env.RELEASE_FAKE_S3_DIR
    ? resolve(process.env.RELEASE_FAKE_S3_DIR)
    : resolve(__dirname, 'fake-s3');

function genFakeS3FilePath(key) {
    return resolve(fakeS3Dir, ...key.split('/'));
}

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isArm64 = process.arch === 'arm64';
const isLinux = process.platform === 'linux';
const isUbuntu = process.env.RELEASE_LINUX_IS_UBUNTU === 'true';
const isFedora = process.env.RELEASE_LINUX_IS_FEDORA === 'true';
const contentTypeJson = 'application/json';

function filterBinFileInfo(prefix, data, ext) {
    return data
        .filter((item) => {
            return item.fileFullName.endsWith(ext);
        })
        .map((item) => {
            const date = new Date(item.releaseDate);
            return {
                fileFullName: item.fileFullName,
                checksum: item.checksum,
                publicPath: `${PUBLIC_BASE_KEY_PREFIX}/${prefix}/${item.fileFullName}`,
                releaseDate: date.toISOString(),
            };
        });
}

/**
 * The media helpers (yt-dlp / ffmpeg / qjs) are not inside the packages any more:
 * `extra-work/build-extra-bin.mjs` packs them per platform and `release.sh`
 * stages the pack into `<prefix>/extra-bin/`. Absent is legitimate — only some
 * platforms have committed binaries — and then the platform simply keeps
 * whatever `extraBin` entries it already published.
 */
function getExtraBinItem(prefix) {
    const dirName = process.env.RELEASE_EXTRA_BIN_DIR_NAME;
    const dirPath = resolve(process.env.RELEASE_STORAGE_DIR, prefix, dirName);
    if (!dirName || !existsSync(dirPath)) {
        return null;
    }
    const fileFullName = readdirSync(dirPath).find((name) => {
        return name.startsWith('bin-') && name.endsWith('.tar.gz');
    });
    const binInfoFilePath = resolve(dirPath, 'bin-info.json');
    if (!fileFullName || !existsSync(binInfoFilePath)) {
        return null;
    }
    const binInfo = JSON.parse(readFileSync(binInfoFilePath, 'utf-8'));
    return {
        key: `${BASE_KEY_PREFIX}/${prefix}/${dirName}/${fileFullName}`,
        filePath: resolve(dirPath, fileFullName),
        url: `${homepage}/${PUBLIC_BASE_KEY_PREFIX}/${prefix}/${dirName}/${fileFullName}`,
        version: binInfo.version,
        checksum: binInfo.checksum,
    };
}

function readDataFile(prefix) {
    const filePath = resolve(
        process.env.RELEASE_STORAGE_DIR,
        prefix,
        process.env.RELEASE_BIN_FILE_INFO,
    );
    const fileContext = readFileSync(filePath, 'utf-8');
    const data = fileContext
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line)
        .map((line) => {
            const [fileFullName, checksum, releaseDate, version, commitID] =
                line.split(process.env.RELEASE_BIN_FILE_SEPARATOR);
            return {
                fileFullName,
                checksum,
                releaseDate,
                version,
                commitID,
            };
        });
    return data;
}

function genUploadItems(prefix, data, info) {
    const s3Key = `${BASE_KEY_PREFIX}/${prefix}`;
    const extraBinItem = getExtraBinItem(prefix);
    return [
        ...data.map((item) => {
            return {
                key: `${s3Key}/${item.fileFullName}`,
                filePath: resolve(
                    process.env.RELEASE_STORAGE_DIR,
                    prefix,
                    item.fileFullName,
                ),
            };
        }),
        ...(extraBinItem
            ? [{ key: extraBinItem.key, filePath: extraBinItem.filePath }]
            : []),
        // No `body` yet: the published `extraBin` map is CUMULATIVE, so it has
        // to be merged with the copy already on S3 at upload time.
        { key: s3Key, fileFullName: 'info.json', prefix, info, extraBinItem },
    ];
}

function getWindowsBinFilePath(prefix, systemInfo) {
    const data = readDataFile(prefix);
    const info = {
        version: data[0].version,
        commitID: data[0].commitID,
        isWindows: true,
        is64System: !!systemInfo.is64System,
        isArm64: !!systemInfo.isArm64,
        portable: filterBinFileInfo(prefix, data, '.zip'),
        installer: filterBinFileInfo(prefix, data, '.exe'),
    };
    return genUploadItems(prefix, data, info);
}

function getMacBinFilePath(prefix, systemInfo) {
    const data = readDataFile(prefix);
    const info = {
        version: data[0].version,
        commitID: data[0].commitID,
        isMac: true,
        isArm64: !!systemInfo.isArm64,
        isUniversal: !!systemInfo.isUniversal,
        portable: filterBinFileInfo(prefix, data, '.zip'),
        installer: filterBinFileInfo(prefix, data, '.dmg'),
    };
    return genUploadItems(prefix, data, info);
}

function getLinuxBinFilePath(prefix, systemInfo) {
    const data = readDataFile(prefix);
    const info = {
        version: data[0].version,
        commitID: data[0].commitID,
        isLinux: true,
        isUbuntu: !!systemInfo.isUbuntu,
        isFedora: !!systemInfo.isFedora,
        is64System: !!systemInfo.is64System,
        portable: filterBinFileInfo(prefix, data, '.AppImage'),
        installer: systemInfo.isUbuntu
            ? filterBinFileInfo(prefix, data, '.deb')
            : systemInfo.isFedora
              ? filterBinFileInfo(prefix, data, '.rpm')
              : [],
    };
    return genUploadItems(prefix, data, info);
}

function getUploadList() {
    const uploadList = [];
    for (const [key, value] of Object.entries(downloadInfo)) {
        if (isWindows && value.isWindows) {
            if ((isArm64 && value.isArm64) || (!isArm64 && !value.isArm64)) {
                uploadList.push(...getWindowsBinFilePath(key, value));
            }
        } else if (isMac && value.isMac) {
            if ((isArm64 && value.isArm64) || (!isArm64 && !value.isArm64)) {
                uploadList.push(...getMacBinFilePath(key, value));
            }
        } else if (isLinux && value.isLinux) {
            if ((isUbuntu && value.isUbuntu) || (isFedora && value.isFedora)) {
                uploadList.push(...getLinuxBinFilePath(key, value));
            }
        }
    }
    return uploadList;
}

function addContentType(putData) {
    const key = putData.Key;
    putData.ContentType = 'application/octet-stream';
    if (key.endsWith('.json')) {
        putData.ContentType = contentTypeJson;
    } else if (key.endsWith('.zip')) {
        putData.ContentType = 'application/zip';
    } else if (key.endsWith('.exe')) {
        putData.ContentType = 'application/x-msdownload';
    } else if (key.endsWith('.dmg')) {
        putData.ContentType = 'application/x-apple-diskimage';
    } else if (key.endsWith('.AppImage')) {
        putData.ContentType = 'application/vnd.appimage';
    } else if (key.endsWith('.deb')) {
        putData.ContentType = 'application/vnd.debian.binary-package';
    } else if (key.endsWith('.rpm')) {
        putData.ContentType = 'application/x-rpm';
    } else if (key.endsWith('.tar.gz')) {
        putData.ContentType = 'application/gzip';
    } else if (key.endsWith('.tar')) {
        putData.ContentType = 'application/x-tar';
    }
}

async function writeToFakeS3(putData) {
    const filePath = genFakeS3FilePath(putData.Key);
    console.log(`Writing to "${filePath}" (${putData.ContentType})`);
    await mkdir(dirname(filePath), { recursive: true });
    if (typeof putData.Body === 'string') {
        await writeFile(filePath, putData.Body, 'utf-8');
    } else {
        // Installers run to hundreds of MB - pipe the read stream `main()`
        // already opened, never buffer it.
        await pipeline(putData.Body, createWriteStream(filePath));
    }
    console.log(`*Written to "${filePath}"`);
}

async function uploadToS3(client, baseKey, body, optionalFileFullName) {
    const key = `${baseKey}${optionalFileFullName ? `/${optionalFileFullName}` : ''}`;
    const bucketName = process.env.RELEASE_AWS_BUCKET_NAME;
    const putData = {
        Bucket: bucketName,
        Key: key,
        Body: body,
    };
    addContentType(putData);
    if (isDryRun) {
        await writeToFakeS3(putData);
        return;
    }
    const command = new PutObjectCommand(putData);
    const url = `s3://${bucketName}/${key}`;
    console.log(`Uploading to "${url}"`);
    let retryCount = 0;
    while (retryCount < 3) {
        try {
            await client.send(command);
            break;
        } catch (error) {
            retryCount++;
            if (retryCount === 3) {
                throw error;
            }
        }
    }
    console.log(`*Uploaded to "${url}"`);
}

async function clearCache(key) {
    const item = `/${key}`;
    if (isDryRun) {
        console.log(`Dry run: skipping cache clearing for "${item}"`);
        return;
    }
    const cloudfront = new CloudFrontClient(instanceInitData);
    const command = new CreateInvalidationCommand({
        DistributionId: process.env.RELEASE_AWS_DISTRIBUTION_ID,
        InvalidationBatch: {
            CallerReference: `caller-reference-${new Date().getTime()}`,
            Paths: {
                Quantity: 1,
                Items: [item],
            },
        },
    });
    await cloudfront.send(command);
    console.log('Clear cache done for', item);
}

/**
 * The `extraBin` map in a platform's `info.json` is cumulative: it names one
 * media pack per app version, and an app only ever finds its own. Rewriting the
 * file from scratch would orphan every version already out there, so the
 * previous copy has to be read back first.
 *
 * Read from S3, not from the public URL: the object is the same, but this is
 * strongly consistent, unaffected by CloudFront edge staleness, and immune to
 * the CDN's SPA-index fallback, which answers HTTP 200 with HTML and would
 * otherwise parse-fail into "no previous entries".
 *
 * A missing object is the legitimate first publish and returns null. ANY other
 * failure throws — losing the map silently is far worse than a failed release.
 */
async function readRemoteInfo(s3Client, prefix) {
    const key = `${BASE_KEY_PREFIX}/${prefix}/info.json`;
    // The fake bucket is never wiped, so a dry run merges against whatever the
    // previous dry runs wrote - the same cumulative merge, offline.
    if (isDryRun) {
        try {
            return JSON.parse(await readFile(genFakeS3FilePath(key), 'utf-8'));
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(
                    `No existing "${key}", first publish for this platform`,
                );
                return null;
            }
            throw error;
        }
    }
    try {
        const output = await s3Client.send(
            new GetObjectCommand({
                Bucket: process.env.RELEASE_AWS_BUCKET_NAME,
                Key: key,
            }),
        );
        return JSON.parse(await output.Body.transformToString());
    } catch (error) {
        if (
            error.name === 'NoSuchKey' ||
            error.$metadata?.httpStatusCode === 404
        ) {
            console.log(`No existing "${key}", first publish for this platform`);
            return null;
        }
        throw error;
    }
}

async function genInfoBody(s3Client, item) {
    const { prefix, info, extraBinItem } = item;
    const remoteInfo = await readRemoteInfo(s3Client, prefix);
    const extraBin = { ...(remoteInfo?.extraBin ?? {}) };
    if (extraBinItem === null) {
        console.log(`No extra-bin pack for "${prefix}", keeping the old map`);
    } else {
        // Keyed by the app version this pack was released with — the same
        // zero-padded string the app reads as `appProvider.appInfo.version`.
        extraBin[info.version] = {
            url: extraBinItem.url,
            version: extraBinItem.version,
            checksum: extraBinItem.checksum,
        };
    }
    const fullInfo = Object.keys(extraBin).length ? { ...info, extraBin } : info;
    return JSON.stringify(fullInfo, null, 2);
}

async function main() {
    const s3Client = isDryRun ? null : new S3Client(instanceInitData);
    const uploadList = getUploadList();
    for (const item of uploadList) {
        if (item.info) {
            const body = await genInfoBody(s3Client, item);
            await uploadToS3(s3Client, item.key, body, item.fileFullName);
        } else {
            await uploadToS3(
                s3Client,
                item.key,
                createReadStream(item.filePath),
            );
        }
    }
    await uploadToS3(
        s3Client,
        BASE_KEY_PREFIX,
        JSON.stringify(downloadInfo, null, 2),
        'info.json',
    );
    await clearCache('download/*');
}

const targetTitle = isDryRun ? `fake S3 "${fakeS3Dir}"` : 'S3';
console.log(`Pushing to ${targetTitle}...`);
main()
    .then(() => {
        console.log(`Done pushing to ${targetTitle}.`);
        process.exit(0);
    })
    .catch((err) => {
        console.error(`Error pushing to ${targetTitle}:`, err);
        process.exit(1);
    });
