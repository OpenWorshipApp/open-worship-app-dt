export declare function pickNoteSinceMs(times: {
    docMs: number;
    reviewMs?: number;
}): number;
export declare function countCommitsTouching(
    commitList: { timeMs: number; fileList: string[] }[],
    sinceMs: number,
    relPathSet: Set<string>,
): { commitCount: number; movedSet: Set<string> };
export declare const PACKAGE_KEY_MARK: string;
export declare function toRealNotePath(relPath: string): string;
export declare function readPackageKeySet(text: string | null): Set<string>;
export declare function readPackageKeyLines(
    text: string | null,
    key: string,
): string | null;
export declare function listPackageKeysNamed(
    tokenList: string[],
    keySet: Set<string>,
): Set<string>;
export declare function readPackageKeyLog(
    logText: string,
): Map<string, Set<string>>;
