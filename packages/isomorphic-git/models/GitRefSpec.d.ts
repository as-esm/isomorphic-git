export class GitRefSpec {
    static from(refspec: any): GitRefSpec;
    constructor({ remotePath, localPath, force, matchPrefix }: {
        remotePath: any;
        localPath: any;
        force: any;
        matchPrefix: any;
    });
    translate(remoteBranch: any): any;
    reverseTranslate(localBranch: any): any;
}
