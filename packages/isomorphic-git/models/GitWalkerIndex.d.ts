export class GitWalkerIndex {
    constructor({ fs, gitdir, cache }: {
        fs: any;
        gitdir: any;
        cache: any;
    });
    treePromise: Promise<any>;
    ConstructEntry: {
        new (fullpath: any): {
            _fullpath: any;
            _type: boolean;
            _mode: boolean;
            _stat: boolean;
            _oid: boolean;
            type(): Promise<any>;
            mode(): Promise<any>;
            stat(): Promise<any>;
            content(): Promise<void>;
            oid(): Promise<any>;
        };
    };
    readdir(entry: any): Promise<any>;
    type(entry: any): Promise<any>;
    mode(entry: any): Promise<any>;
    stat(entry: any): Promise<any>;
    content(_entry: any): Promise<void>;
    oid(entry: any): Promise<any>;
}
