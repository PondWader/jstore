import fs from "node:fs/promises";
import { decodeObject, encodeObject } from "./binary.ts";

export type StoreOptions = {
    file: string;
    maxCacheObjects?: number;
}
export type Store = JStore;

const DEFAULT_MAX_CACHE_OBJECTS = 256;
const MAIN_FILE_MAGIC = Buffer.from('JStore-MainFile');
const MAIN_FILE_VERSION = 1;

export function createStore(opts: StoreOptions): Promise<Store> {
    if (opts.maxCacheObjects === undefined) opts.maxCacheObjects = DEFAULT_MAX_CACHE_OBJECTS;
    const store = new JStore(opts.file);
    return store.init();
}

class JStore {
    #path: string;
    #handle: fs.FileHandle;

    constructor(path: string) {
        this.#path = path;
    }

    /**
     * Opens the store file, if using `createStore` this will automatically be called when creating the store and shouldn't be called again.
     * @returns 
     */
    async init() {
        const handle = await fs.open(this.#path, 'a+');
        this.#handle = handle;
        const stat = await handle.stat();

        // Write or check header to ensure file is a valid JStore file
        if (stat.size === 0) {
            const headerBuf = Buffer.allocUnsafe(MAIN_FILE_MAGIC.length + 4);
            MAIN_FILE_MAGIC.copy(headerBuf);
            headerBuf.writeUint32LE(MAIN_FILE_VERSION, MAIN_FILE_MAGIC.length)
            await handle.write(headerBuf);
        } else {
            const buf = Buffer.allocUnsafe(MAIN_FILE_MAGIC.length + 4);
            await handle.read(buf);
            if (!buf.subarray(0, MAIN_FILE_MAGIC.length).equals(MAIN_FILE_MAGIC)) {
                throw new Error(`File "${this.#path}" is not a valid JStore file. (HEADER_MAGIC_MISSING)`);
            }
            if (buf.readUint32LE(MAIN_FILE_MAGIC.length) !== MAIN_FILE_VERSION) {
                throw new Error(`File "${this.#path}" is not a valid JStore version. (HEADER_VERSION_INVALID)`);
            }
        }

        // TODO: Check if there are any partial writes that need recovered from

        return this;
    }

    async add(obj: any) {
        await this.#handle.appendFile(encodeObject(obj));
    }


    // Extremely unoptimised implementations just for demonstration for now

    async find(query: any) {
        const queryEntries = Object.entries(query);

        const objs = await this.getAll();
        for (const obj of objs) {
            // Check if matches query
            for (const [key, val] of queryEntries) {
                if (obj[key] === val) return obj;
            }
        }
        return null;
    }

    async findMany(query: any) {
        const queryEntries = Object.entries(query);

        const objs = await this.getAll();
        const matches: any[] = [];
        for (const obj of objs) {
            // Check if matches query
            for (const [key, val] of queryEntries) {
                if (obj[key] === val) matches.push(obj);
            }
        }
        return matches;
    }

    async getAll() {
        const items: any[] = [];
        const buf = await fs.readFile(this.#path);
        let offset = MAIN_FILE_MAGIC.length + 4;
        while (offset < buf.length) {
            const result = decodeObject(new DataView(buf.buffer.slice(offset)));
            offset += result.bytesRead;
            items.push(result.result);
        }
        return items;
    }

    delete() {

    }

    get path() {
        return this.#path;
    }

    close() {
        return this.#handle.close();
    }
}

