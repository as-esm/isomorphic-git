export class RemoteCapabilityError extends BaseError {
    /**
     * @param {'shallow'|'deepen-since'|'deepen-not'|'deepen-relative'} capability
     * @param {'depth'|'since'|'exclude'|'relative'} parameter
     */
    constructor(capability: "shallow" | "deepen-since" | "deepen-not" | "deepen-relative", parameter: "depth" | "since" | "exclude" | "relative");
    code: "RemoteCapabilityError";
    name: "RemoteCapabilityError";
    data: {
        capability: "shallow" | "deepen-since" | "deepen-not" | "deepen-relative";
        parameter: "depth" | "since" | "exclude" | "relative";
    };
}
export namespace RemoteCapabilityError {
    let code: "RemoteCapabilityError";
}
import { BaseError } from './BaseError.js';
