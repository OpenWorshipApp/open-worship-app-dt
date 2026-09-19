// Guards `npm run pack:win:store`.
//
// A Store package cannot be guessed at: Partner Center assigns the package
// identity (Product management -> Product identity) and refuses an upload whose
// Identity Name, Publisher or reserved name differs, and it assigns the Store ID
// that the app's own `ms-windows-store://pdp/` link is aimed at.
//
// None of that fails the BUILD, which is the trap: with no `publisher`,
// electron-builder quietly stamps `CN=ms`, and with no `resources/appx` assets
// it packs its own placeholder logos -- the Electron atom -- as the Start tile
// and taskbar icon. Both produce a package that looks fine and is wrong, one
// rejected at upload and one shipped to every Store user. So the values are read
// here, before the long build, and named.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const PARTNER_CENTER_HINT =
    'Partner Center -> your app -> Product management -> Product identity';
// electron-builder packs its own logo for every one of these that is missing.
const REQUIRED_ASSET_FILE_NAMES = [
    'StoreLogo.png',
    'Square44x44Logo.png',
    'Square150x150Logo.png',
    'Wide310x150Logo.png',
];

const packageJson = JSON.parse(
    readFileSync(resolve('./package.json'), 'utf-8'),
);
const appx = packageJson.build?.appx ?? {};
const problems = [];

function checkIsFilled(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function checkIsPlaceholder(value) {
    return checkIsFilled(value) && value.toUpperCase().includes('REPLACE');
}

function addProblem(field, value, reason) {
    problems.push(`${field}: ${reason} (found ${JSON.stringify(value)})`);
}

function checkIdentityField(field, value, extraCheck = null) {
    if (!checkIsFilled(value)) {
        addProblem(field, value, `is not set -- copy it from ${PARTNER_CENTER_HINT}`);
        return;
    }
    if (checkIsPlaceholder(value)) {
        addProblem(field, value, `is still the placeholder -- copy the real value from ${PARTNER_CENTER_HINT}`);
        return;
    }
    const extraReason = extraCheck === null ? null : extraCheck(value);
    if (extraReason !== null) {
        addProblem(field, value, extraReason);
    }
}

checkIdentityField('build.appx.identityName', appx.identityName, (value) => {
    if (!/^[a-zA-Z0-9.-]{3,50}$/.test(value)) {
        return 'is not a valid identity name (3-50 letters, digits, "." or "-")';
    }
    return null;
});
checkIdentityField('build.appx.publisher', appx.publisher, (value) => {
    if (!value.startsWith('CN=')) {
        return 'must be the full Publisher value, which starts with "CN="';
    }
    if (value === 'CN=ms') {
        // What electron-builder falls back to, and what Partner Center rejects.
        return 'is electron-builder\'s unsigned fallback, not a real publisher';
    }
    return null;
});
checkIdentityField('build.appx.publisherDisplayName', appx.publisherDisplayName);
// Not an identity field, but the Store matches it against the reserved name.
checkIdentityField('build.appx.displayName', appx.displayName);
checkIdentityField(
    'msStoreProductId',
    packageJson.msStoreProductId,
    (value) => {
        if (!/^[A-Za-z0-9]{8,}$/.test(value)) {
            return 'is not a Store ID (e.g. "9NBLGGH4NNS1"), shown on the same page';
        }
        return null;
    },
);

const assetDirPath = resolve(
    `./${packageJson.build?.directories?.buildResources ?? 'build'}/appx`,
);
const missingAssetFileNames = REQUIRED_ASSET_FILE_NAMES.filter((fileName) => {
    return !existsSync(resolve(assetDirPath, fileName));
});
if (missingAssetFileNames.length > 0) {
    problems.push(
        `${assetDirPath}: missing ${missingAssetFileNames.join(', ')} -- ` +
            'without them the package ships electron-builder\'s own logo',
    );
}

if (problems.length > 0) {
    console.error('Cannot build a Microsoft Store package yet:\n');
    for (const problem of problems) {
        console.error(`  - ${problem}`);
    }
    console.error(
        '\nSee the "Microsoft Store" section of README.md. Nothing was built.',
    );
    process.exit(1);
}

console.log('Store package identity and assets are set.');
