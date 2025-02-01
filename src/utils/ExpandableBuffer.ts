export class ExpandableBuffer {
    #buffer: Uint8Array;
    #dataView: DataView;
    #offset = 0;

    constructor(startSize: number = 256) {
        this.#buffer = new Uint8Array(startSize);
        this.#dataView = new DataView(this.#buffer.buffer);
    }

    #expandToFit(size: number) {
        if (this.#offset + size > this.#buffer.length) {
            const resizedBuffer = new Uint8Array(this.#buffer.length * 2);
            resizedBuffer.set(this.#buffer);
            this.#buffer = resizedBuffer;
            this.#dataView = new DataView(this.#buffer.buffer);
            return this.#expandToFit(size);
        }
    }

    append(array: ArrayLike<number>) {
        this.#expandToFit(array.length);
        this.#buffer.set(array, this.#offset);
        this.#offset += array.length;
        return this;
    }

    appendUint32LE(value: number) {
        this.#dataView.setUint32(this.#offset, value, true);
        this.#offset += 4;
        return this;
    }

    appendInt64LE(value: number) {
        this.#dataView.setBigInt64(this.#offset, BigInt(value), true);
        this.#offset += 8;
        return this;
    }

    appendFloat64LE(value: number) {
        this.#dataView.setFloat64(this.#offset, value, true);
        this.#offset += 8;
        return this;
    }

    appendString(str: string, encoding: BufferEncoding = 'utf-8') {
        return this.append(Buffer.from(str, encoding));
    }

    toUint8Array() {
        return this.#buffer.subarray(0, this.#offset);
    }

    toString() {
        return this.toUint8Array().toString();
    }
}
