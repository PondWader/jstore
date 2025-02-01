import { ExpandableBuffer } from "./utils/ExpandableBuffer.ts";

const OBJECT_CODE = 0;
const STRING_CODE = 1;
const INT_CODE = 2;
const FLOAT_CODE = 3;
const BOOL_CODE = 4;
const ARRAY_CODE = 5;

// Encoder

export function encodeObject(object: any) {
    if (typeof object !== 'object') throw new Error('Invalid object passed to encoder.');

    let buf = new ExpandableBuffer();
    encodeObjectWithBuf(object, buf);
    return buf.toUint8Array();
}

function encodeObjectWithBuf(object: any, buf: ExpandableBuffer) {
    const entries = Object.entries(object);
    buf.appendUint32LE(entries.length);
    for (const [key, val] of entries) {
        encode(key, buf);
        encode(val, buf);
    }
}

function encode(val: any, buf: ExpandableBuffer) {
    switch (typeof val) {
        case "string":
            buf.append([STRING_CODE])
            buf.appendUint32LE(val.length)
            buf.appendString(val);
            break;

        case "boolean":
            buf.append([BOOL_CODE, val ? 1 : 0]);
            break;

        case "number":
            if (Number.isInteger(val)) {
                buf.append([INT_CODE]);
                buf.appendInt64LE(val);
            } else {
                buf.append([FLOAT_CODE]);
                buf.appendFloat64LE(val);
            }
            break;

        case "object":
            if (Array.isArray(val)) {
                buf.append([ARRAY_CODE]);
                buf.appendUint32LE(val.length);

                for (const item of val) {
                    encode(item, buf);
                }
            } else {
                buf.append([OBJECT_CODE]);
                encodeObjectWithBuf(val, buf);
            }
            break;

        default:
            throw new Error(`Unexpected value type: ${typeof val}.`);
    }
}

// Decoder
export function decodeObject(buf: DataView) {
    const entriesCount = buf.getUint32(0, true);
    const obj = Object.create(null);
    let offset = 4;
    for (let i = 0; i < entriesCount; i++) {
        const keyDecode = decode(offset, buf);
        offset += keyDecode.bytesRead;
        const valDecode = decode(offset, buf);
        offset += valDecode.bytesRead;

        obj[keyDecode.result] = valDecode.result;
    }

    return { result: obj, bytesRead: offset };
}

const textDecoder = new TextDecoder();

function decode(offset: number, buf: DataView): {
    result: any,
    bytesRead: number
} {
    switch (buf.getUint8(offset)) {
        case STRING_CODE:
            const len = buf.getUint32(offset + 1, true);
            const result = textDecoder.decode(buf.buffer.slice(offset + 5, offset + 5 + len));
            return { result, bytesRead: 5 + len };

        case BOOL_CODE:
            return { result: buf.getUint8(offset + 1) === 1, bytesRead: 2 };

        case INT_CODE:
            return { result: Number(buf.getBigInt64(offset + 1, true)), bytesRead: 9 };

        case FLOAT_CODE:
            return { result: buf.getFloat64(offset + 1, true), bytesRead: 9 }

        case ARRAY_CODE:
            const arrayLen = buf.getUint32(offset + 1, true);
            let startingOffset = offset;
            offset += 5;
            const array = new Array(arrayLen);
            for (let i = 0; i < arrayLen; i++) {
                const result = decode(offset, buf);
                offset += result.bytesRead;
                array[i] = result.result;
            }
            return { result: array, bytesRead: offset - startingOffset };

        case OBJECT_CODE:
            const decoded = decodeObject(new DataView(buf.buffer.slice(offset + 1)));
            decoded.bytesRead++;
            return decoded;
    }

    throw new Error(`Unexpected value code: ${buf.getUint8(offset)}.`);
}

