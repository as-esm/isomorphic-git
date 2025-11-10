export class GitConfig {
    static from(text: any): GitConfig;
    constructor(text: any);
    parsedConfig: any;
    get(path: any, getall?: boolean): Promise<any>;
    getall(path: any): Promise<any>;
    getSubsections(section: any): Promise<any>;
    deleteSection(section: any, subsection: any): Promise<void>;
    append(path: any, value: any): Promise<void>;
    set(path: any, value: any, append?: boolean): Promise<void>;
    toString(): any;
}
