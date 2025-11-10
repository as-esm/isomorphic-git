export class BaseError extends Error {
    constructor(message: any);
    caller: string;
    toJSON(): {
        code: any;
        data: any;
        caller: string;
        message: string;
        stack: string | undefined;
    };
    fromJSON(json: any): BaseError;
    get isIsomorphicGitError(): boolean;
}
