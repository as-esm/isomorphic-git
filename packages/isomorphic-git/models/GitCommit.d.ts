export class GitCommit {
    static fromPayloadSignature({ payload, signature }: {
        payload: any;
        signature: any;
    }): GitCommit;
    static from(commit: any): GitCommit;
    static justMessage(commit: any): any;
    static justHeaders(commit: any): any;
    static renderHeaders(obj: any): string;
    static render(obj: any): string;
    static sign(commit: any, sign: any, secretKey: any): Promise<GitCommit>;
    constructor(commit: any);
    _commit: string;
    toObject(): Buffer<ArrayBuffer>;
    headers(): {
        parent: never[];
    };
    message(): any;
    parse(): {
        message: any;
    } & {
        parent: never[];
    };
    parseHeaders(): {
        parent: never[];
    };
    render(): string;
    withoutSignature(): any;
    isolateSignature(): any;
}
