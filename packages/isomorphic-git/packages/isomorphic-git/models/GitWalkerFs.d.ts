export class GitWalkerFs {
    constructor({ fs, dir, gitdir, cache }: {
        fs: any;
        dir: any;
        gitdir: any;
        cache: any;
    });
    fs: any;
    cache: any;
    dir: any;
    gitdir: any;
    config: import("./GitConfig.js").GitConfig | null;
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
            stat(): Promise<any>;
            content(): Promise<any>;
            oid(): Promise<any>;
        };
    };
    readdir(entry: any): Promise<any>;
    type(entry: any): Promise<any>;
    mode(entry: any): Promise<any>;
    stat(entry: any): Promise<any>;
    content(entry: any): Promise<any>;
    oid(entry: any): Promise<any>;
    _getGitConfig(fs: any, gitdir: any): Promise<import("./GitConfig.js").GitConfig>;
}
