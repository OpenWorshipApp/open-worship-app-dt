'use strict';
/* eslint-disable */

const { createReadStream, readFileSync } = require('node:fs');
const {
    CloudFrontClient,
    CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const instanceInitData = {
    apiVersion: 'latest',
    region: process.env.RELEASE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.RELEASE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.RELEASE_AWS_SECRET_ACCESS_KEY,
    },
};

const downloadInfo = require('./download-info.json');
const { resolve } = require('node:path');

const PUBLIC_BASE_KEY_PREFIX = 'download';
const BASE_KEY_PREFIX = 'www/download';

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
    const s3Key = `${BASE_KEY_PREFIX}/${prefix}`;
    return [
        {
            key: s3Key,
            body: JSON.stringify(info, null, 2),
            fileFullName: 'info.json',
        },
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
    ];
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
    const s3Key = `${BASE_KEY_PREFIX}/${prefix}`;
    return [
        {
            key: s3Key,
            body: JSON.stringify(info, null, 2),
            fileFullName: 'info.json',
        },
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
    ];
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
            : [],
    };
    const s3Key = `${BASE_KEY_PREFIX}/${prefix}`;
    return [
        {
            key: s3Key,
            body: JSON.stringify(info, null, 2),
            fileFullName: 'info.json',
        },
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
    ];
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
    } else if (key.endsWith('.tar.gz')) {
        putData.ContentType = 'application/gzip';
    } else if (key.endsWith('.tar')) {
        putData.ContentType = 'application/x-tar';
    }
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
    const command = new PutObjectCommand(putData);
    const url = `s3://${bucketName}/${key}`;
    console.log(`Uploading to "${url}"`);
    await client.send(command);
    console.log(`*Uploaded to "${url}"`);
}

async function clearCache(key) {
    const item = `/${key}`;
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

async function main() {
    const s3Client = new S3Client(instanceInitData);
    await uploadToS3(
        s3Client,
        BASE_KEY_PREFIX,
        JSON.stringify(downloadInfo, null, 2),
        'info.json',
    );
    const uploadList = getUploadList();
    await Promise.all(
        uploadList.map((item) => {
            if (item.body) {
                return uploadToS3(
                    s3Client,
                    item.key,
                    item.body,
                    item.fileFullName,
                );
            } else {
                return uploadToS3(
                    s3Client,
                    item.key,
                    createReadStream(item.filePath),
                );
            }
        }),
    );
    await clearCache('download/*');
}

console.log('Pushing to S3...');
main()
    .then(() => {
        console.log('Done pushing to S3.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error pushing to S3:', err);
        process.exit(1);
    });
