export class GitRefStash {
    static get timezoneOffsetForRefLogEntry(): string;
    static createStashReflogEntry(author: any, stashCommit: any, message: any): string;
    static getStashReflogEntry(reflogString: any, parsed?: boolean): any;
}
