import packageInfo from '../../package.json';

function toVersionNumber(version: string) {
    const [major, minor, patch] = version
        .split('.')
        .map((str) => Number.parseInt(str, 10));
    return major * 10000 + minor * 100 + patch;
}

const appInfo = {
    name: packageInfo.name,
    title: packageInfo.build.productName,
    titleFull: `${packageInfo.build.productName} (desktop version)`,
    description: packageInfo.description,
    author: packageInfo.author,
    homepage: packageInfo.homepage.replace(/\/+$/, ''),
    gitRepository: packageInfo.gitRepository,
    // The Store ID Partner Center assigns at name reservation (empty until
    // then). It is what an `ms-windows-store://pdp/` link aims at.
    msStoreProductId: packageInfo.msStoreProductId,
    version: packageInfo.version,
    versionNumber: toVersionNumber(packageInfo.version),
};

export default appInfo;
