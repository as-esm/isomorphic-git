export function readObjectLoose({ fs, gitdir, oid }: {
    fs: any;
    gitdir: any;
    oid: any;
}): Promise<{
    object: any;
    format: string;
    source: string;
} | null>;
