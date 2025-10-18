'use strict';
/* eslint-disable */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { release } from 'node:os';

const commitHash = execSync('git rev-parse HEAD').toString().trim();
const packageStr = readFileSync('./electron-build/package-lock.json', 'utf-8');
const packageJson = JSON.parse(packageStr);

packageJson.commitHash = commitHash;
packageJson.debugBuildSystemInfo = `
Node.js Version: ${process.versions.node}
V8 Version: ${process.versions.v8}
OS: ${process.platform} ${process.arch} ${release()}
`.trim();

writeFileSync(
    './electron-build/package-info.json',
    JSON.stringify(packageJson, null, 4),
);
console.log('Build info is generated');
