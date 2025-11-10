export class GitSideBand {
    static demux(input: any): {
        packetlines: FIFO;
        packfile: FIFO;
        progress: FIFO;
    };
}
import { FIFO } from '../utils/FIFO.js';
