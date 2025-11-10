export function resolveCommit({ fs, cache, gitdir, oid }: {
    fs: any;
    cache: any;
    gitdir: any;
    oid: any;
}): Promise<{
    commit: GitCommit;
    oid: any;
}>;
import { GitCommit } from '../models/GitCommit.js';
