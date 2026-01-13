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
    titleFull: `${packageInfo.build.productName} (Desktop version)`,
    description: packageInfo.description,
    author: packageInfo.author,
    homepage: packageInfo.homepage.replace(/\/+$/, ''),
    gitRepository: packageInfo.gitRepository,
    version: packageInfo.version,
    versionNumber: toVersionNumber(packageInfo.version),
};

export default appInfo;
