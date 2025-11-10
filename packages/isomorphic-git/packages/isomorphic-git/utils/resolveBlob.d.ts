export function resolveBlob({ fs, cache, gitdir, oid }: {
    fs: any;
    cache: any;
    gitdir: any;
    oid: any;
}): Promise<{
    oid: any;
    blob: Uint8Array<any>;
}>;
