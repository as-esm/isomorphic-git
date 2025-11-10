export class GitAnnotatedTag {
    static from(tag: any): GitAnnotatedTag;
    static render(obj: any): string;
    static sign(tag: any, sign: any, secretKey: any): Promise<GitAnnotatedTag>;
    constructor(tag: any);
    _tag: string;
    justHeaders(): string;
    message(): any;
    parse(): {
        tagger: any;
        committer: any;
    } & {
        message: any;
        gpgsig: any;
    };
    render(): string;
    headers(): {
        tagger: any;
        committer: any;
    };
    withoutSignature(): any;
    gpgsig(): any;
    payload(): string;
    toObject(): Buffer<ArrayBuffer>;
}
