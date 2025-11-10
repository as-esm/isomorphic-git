export function resolveTree({ fs, cache, gitdir, oid }: {
    fs: any;
    cache: any;
    gitdir: any;
    oid: any;
}): Promise<{
    tree: GitTree;
    oid: any;
}>;
import { GitTree } from '../models/GitTree.js';
