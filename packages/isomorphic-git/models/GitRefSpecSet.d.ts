export class GitRefSpecSet {
    static from(refspecs: any): GitRefSpecSet;
    constructor(rules?: any[]);
    rules: any[];
    add(refspec: any): void;
    translate(remoteRefs: any): any[][];
    translateOne(remoteRef: any): any;
    localNamespaces(): any[];
}
