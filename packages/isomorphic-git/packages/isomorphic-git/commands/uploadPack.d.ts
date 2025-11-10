export function uploadPack({ fs, dir, gitdir, advertiseRefs, }: {
    fs: any;
    dir: any;
    gitdir?: any;
    advertiseRefs?: boolean | undefined;
}): Promise<Buffer<ArrayBuffer>[] | undefined>;
