'use strict';
/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

let filePath = new URL(import.meta.url).pathname;
if (filePath.startsWith('/')) {
    filePath = filePath.slice(1);
}
const cwd = path.dirname(filePath);
console.log('Current working dir:', cwd);
const packageJsonPath = path.join(cwd, '..', 'package.json');
let packageJsonStr = fs.readFileSync(packageJsonPath, 'utf8');

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');

const todayVersion = `${year}.${month}.${day}`;

const regex = /"version":\s*"[0-9]+\.[0-9]+\.[0-9]+"/;
packageJsonStr = packageJsonStr.replace(regex, `"version": "${todayVersion}"`);

fs.writeFileSync(packageJsonPath, packageJsonStr, 'utf8');

console.log(`Updated package.json version to ${todayVersion}`);
