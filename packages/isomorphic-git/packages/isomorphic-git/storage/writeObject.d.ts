export function _writeObject({ fs, gitdir, type, object, format, oid, dryRun, }: {
    fs: any;
    gitdir: any;
    type: any;
    object: any;
    format?: string | undefined;
    oid?: string | undefined;
    dryRun?: boolean | undefined;
}): Promise<string>;
