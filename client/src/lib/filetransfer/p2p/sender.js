import {fileToArrayBuffer} from 'lib/fs/util';
import Logger from 'lib/logger';
import {CHUNK_SIZE, CHUNKS_PER_BLOCK} from '../index';

export default class FileSender {
    static encodeChunk(index, chunk) {
        let buffer = new ArrayBuffer(4 + chunk.byteLength);
        let dataview = new DataView(buffer);
        dataview.setUint32(0, index);
        dataview = new Uint8Array(buffer);
        // let  = new Uint8Array(chunk);
        dataview.set(chunk, 4);
        return buffer;
    }

    constructor({file, channel, logger}) {
        // split file into chunks
        this.file = file;
        this.channel = channel;
        this.chunkSize = CHUNK_SIZE;
        this.channel.onmessage = this.onChannelMessage.bind(this);
        this.numChunks = Math.ceil(this.file.filesize / CHUNK_SIZE);
        this.logger = new Logger(logger, `FileSender:${this.file.filename}`);
        this.blocksQueue = [];
    }

    sendMetadata() {
        this.channel.send(JSON.stringify({
            'metadata': {
                name: this.file.filename,
                size: this.file.filesize,
                type: this.file.type,
            },
        }));
    }

    onChannelMessage(evt) {
        this.onJSONMessage(JSON.parse(evt.data));
    }

    async onJSONMessage(msg) {
        this.logger.log('Received channel message', msg);
        if (msg.type == 'requestMetadata') {
            this.sendMetadata();
        }
        if (msg.type == 'requestChunks') {
            this.logger.info(`Chunks requested from index ${msg.index}`);
            let block = await this.getBlockBuffer(msg.index, {queueNext: true});
            let upper = Math.min(msg.index + CHUNKS_PER_BLOCK, this.numChunks);
            for (let i = msg.index; i < upper; ++i) {
                let begin = (i % CHUNKS_PER_BLOCK) * this.chunkSize;
                let end = Math.min(((i + 1) % CHUNKS_PER_BLOCK) * this.chunkSize, block.byteLength);
                let chunk = block.slice(begin, end);
                this.sendNthChunk(i, chunk);
            }
        }
    }

    async queueNextBlock(index) {
        if (index + CHUNKS_PER_BLOCK > this.numChunks) {
            return;
        }
        let block = await this.getBlockBuffer(index + CHUNKS_PER_BLOCK, {queueNext: false});
        this.blocksQueue.push({buf: block, index: index});
        if (this.blocksQueue.length > 4) {
            this.blocksQueue.shift();
        }
    }

    sendNthChunk(n, chunk) {
        this.logger.log(`Sending chunk ${n} of ${this.numChunks}`);
        let encoded = FileSender.encodeChunk(n, chunk);
        this.channel.send(encoded);
    }

    async getBlockBuffer(index, {queueNext = false}) {
        if (queueNext) {
            this.queueNextBlock(index);
        }
        let block = _.find(this.blocksQueue, b => b.index == index);
        if (block) {
            return block.buf;
        }
        else {
            let bytesLeft = this.file.filesize - index * this.chunkSize;
            let blob = await this.file.readFileAt(
                index * this.chunkSize,
                Math.min(CHUNKS_PER_BLOCK * this.chunkSize, bytesLeft)
            );
            let buf = await fileToArrayBuffer(blob);
            return buf;
        }
    }
}