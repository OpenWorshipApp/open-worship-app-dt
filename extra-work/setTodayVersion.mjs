'use strict';
/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
console.log(new URL(import.meta.url).pathname);

const filePath = new URL(import.meta.url).pathname;
const cwd = path.dirname(filePath);
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
