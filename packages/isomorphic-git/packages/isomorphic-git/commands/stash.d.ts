export function _stashPush({ fs, dir, gitdir, message }: {
    fs: any;
    dir: any;
    gitdir: any;
    message?: string | undefined;
}): Promise<string>;
export function _stashCreate({ fs, dir, gitdir, message }: {
    fs: any;
    dir: any;
    gitdir: any;
    message?: string | undefined;
}): Promise<string>;
export function _stashApply({ fs, dir, gitdir, refIdx }: {
    fs: any;
    dir: any;
    gitdir: any;
    refIdx?: number | undefined;
}): Promise<void>;
export function _stashDrop({ fs, dir, gitdir, refIdx }: {
    fs: any;
    dir: any;
    gitdir: any;
    refIdx?: number | undefined;
}): Promise<void>;
export function _stashList({ fs, dir, gitdir }: {
    fs: any;
    dir: any;
    gitdir: any;
}): Promise<any>;
export function _stashClear({ fs, dir, gitdir }: {
    fs: any;
    dir: any;
    gitdir: any;
}): Promise<void>;
export function _stashPop({ fs, dir, gitdir, refIdx }: {
    fs: any;
    dir: any;
    gitdir: any;
    refIdx?: number | undefined;
}): Promise<void>;
