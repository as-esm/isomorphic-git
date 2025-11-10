export function acquireLock(ref: any, callback: any): Promise<any>;
export function writeTreeChanges({ fs, dir, gitdir, treePair, }: {
    fs: any;
    dir: any;
    gitdir: any;
    treePair: any;
}): Promise<string | null>;
export function applyTreeChanges({ fs, dir, gitdir, stashCommit, parentCommit, wasStaged, }: {
    fs: any;
    dir: any;
    gitdir: any;
    stashCommit: any;
    parentCommit: any;
    wasStaged: any;
}): Promise<void>;
