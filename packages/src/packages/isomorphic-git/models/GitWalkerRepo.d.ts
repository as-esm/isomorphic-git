export class GitWalkerRepo {
    constructor({ fs, gitdir, ref, cache }: {
        fs: any;
        gitdir: any;
        ref: any;
        cache: any;
    });
    fs: any;
    cache: any;
    gitdir: any;
    mapPromise: Promise<Map<any, any>>;
    ConstructEntry: {
        new (fullpath: any): {
            _fullpath: any;
            _type: boolean;
            _mode: boolean;
            _stat: boolean;
            _content: boolean;
            _oid: boolean;
            type(): Promise<any>;
            mode(): Promise<any>;
            stat(): Promise<void>;
            content(): Promise<any>;
            oid(): Promise<any>;
        };
    };
    readdir(entry: any): Promise<any[] | null>;
    type(entry: any): Promise<any>;
    mode(entry: any): Promise<any>;
    stat(_entry: any): Promise<void>;
    content(entry: any): Promise<any>;
    oid(entry: any): Promise<any>;
}
