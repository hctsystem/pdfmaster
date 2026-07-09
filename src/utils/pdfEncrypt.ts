import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFNumber
} from 'pdf-lib';

// Standard PDF padding string (from PDF specification)
const PADDING = new Uint8Array([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
  0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
  0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
  0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

// Convert hex string to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, (i * 2) + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Minimal MD5 implementation for PDF security handler
export function md5(data: string | Uint8Array): Uint8Array {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const msgLen = bytes.length;
  const msgBitLen = msgLen * 8;
  const msgLenPadded = ((msgLen + 9 + 63) & ~63);
  const msg = new Uint8Array(msgLenPadded);
  msg.set(bytes);
  msg[msgLen] = 0x80;

  const dataView = new DataView(msg.buffer);
  dataView.setUint32(msgLenPadded - 8, msgBitLen, true);
  dataView.setUint32(msgLenPadded - 4, 0, true);

  for (let offset = 0; offset < msgLenPadded; offset += 64) {
    const chunk = new Uint32Array(msg.buffer, offset, 16);
    let a = a0, b = b0, c = c0, d = d0;

    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = (b & c) | ((~b) & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | ((~d) & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | (~d));
        g = (7 * i) % 16;
      }

      f = (f + a + K[i] + chunk[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const result = new Uint8Array(16);
  const view = new DataView(result.buffer);
  view.setUint32(0, a0, true);
  view.setUint32(4, b0, true);
  view.setUint32(8, c0, true);
  view.setUint32(12, d0, true);

  return result;
}

// Symmetric RC4 Stream Cipher
export class RC4 {
  private s = new Uint8Array(256);
  private i = 0;
  private j = 0;

  constructor(key: Uint8Array) {
    for (let i = 0; i < 256; i++) {
      this.s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.s[i] + key[i % key.length]) & 0xFF;
      const tmp = this.s[i];
      this.s[i] = this.s[j];
      this.s[j] = tmp;
    }
  }

  process(data: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
      this.i = (this.i + 1) & 0xFF;
      this.j = (this.j + this.s[this.i]) & 0xFF;
      
      const tmp = this.s[this.i];
      this.s[this.i] = this.s[this.j];
      this.s[this.j] = tmp;
      
      const t = (this.s[this.i] + this.s[this.j]) & 0xFF;
      result[k] = data[k] ^ this.s[t];
    }
    return result;
  }
}

// Pad password per standard PDF specification
function padPassword(password: string): Uint8Array {
  const pwdBytes = new TextEncoder().encode(password);
  const padded = new Uint8Array(32);
  if (pwdBytes.length >= 32) {
    padded.set(pwdBytes.slice(0, 32));
  } else {
    padded.set(pwdBytes);
    padded.set(PADDING.slice(0, 32 - pwdBytes.length), pwdBytes.length);
  }
  return padded;
}

// Compute Owner Key (O entry)
function computeOwnerKey(ownerPassword: string | null, userPassword: string): Uint8Array {
  const paddedOwner = padPassword(ownerPassword || userPassword);
  let hash = md5(paddedOwner);

  for (let i = 0; i < 50; i++) {
    hash = md5(hash);
  }

  const paddedUser = padPassword(userPassword);
  let result: any = new Uint8Array(paddedUser);

  for (let i = 0; i < 20; i++) {
    const key = new Uint8Array(hash.length);
    for (let j = 0; j < hash.length; j++) {
      key[j] = hash[j] ^ i;
    }
    const rc4 = new RC4(key.slice(0, 16));
    result = rc4.process(result);
  }

  return result;
}

// Compute Encryption Key (Algorithm 2)
function computeEncryptionKey(
  userPassword: string,
  ownerKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array
): Uint8Array {
  const paddedPwd = padPassword(userPassword);
  const hashInput = new Uint8Array(paddedPwd.length + ownerKey.length + 4 + fileId.length);

  let offset = 0;
  hashInput.set(paddedPwd, offset);
  offset += paddedPwd.length;

  hashInput.set(ownerKey, offset);
  offset += ownerKey.length;

  hashInput[offset++] = permissions & 0xFF;
  hashInput[offset++] = (permissions >> 8) & 0xFF;
  hashInput[offset++] = (permissions >> 16) & 0xFF;
  hashInput[offset++] = (permissions >> 24) & 0xFF;

  hashInput.set(fileId, offset);

  let hash = md5(hashInput);
  for (let i = 0; i < 50; i++) {
    hash = md5(hash.slice(0, 16));
  }

  return hash.slice(0, 16);
}

// Compute User Key (U entry)
function computeUserKey(encryptionKey: Uint8Array, fileId: Uint8Array): Uint8Array {
  const hashInput = new Uint8Array(PADDING.length + fileId.length);
  hashInput.set(PADDING);
  hashInput.set(fileId, PADDING.length);

  const hash = md5(hashInput);
  const rc4 = new RC4(encryptionKey);
  let result = rc4.process(hash);

  for (let i = 1; i <= 19; i++) {
    const key = new Uint8Array(encryptionKey.length);
    for (let j = 0; j < encryptionKey.length; j++) {
      key[j] = encryptionKey[j] ^ i;
    }
    const rc4iter = new RC4(key);
    result = rc4iter.process(result);
  }

  const finalResult = new Uint8Array(32);
  finalResult.set(result);
  finalResult.set(new Uint8Array(16), 16);

  return finalResult;
}

// Encrypt a specific indirect object bytes
function encryptObject(data: Uint8Array, objectNum: number, generationNum: number, encryptionKey: Uint8Array): Uint8Array {
  const keyInput = new Uint8Array(encryptionKey.length + 5);
  keyInput.set(encryptionKey);
  keyInput[encryptionKey.length] = objectNum & 0xFF;
  keyInput[encryptionKey.length + 1] = (objectNum >> 8) & 0xFF;
  keyInput[encryptionKey.length + 2] = (objectNum >> 16) & 0xFF;
  keyInput[encryptionKey.length + 3] = generationNum & 0xFF;
  keyInput[encryptionKey.length + 4] = (generationNum >> 8) & 0xFF;

  const objectKey = md5(keyInput);
  const rc4 = new RC4(objectKey.slice(0, Math.min(encryptionKey.length + 5, 16)));
  return rc4.process(data);
}

// Traverses PDF object trees and encrypts strings
function encryptStringsInObject(obj: any, objectNum: number, generationNum: number, encryptionKey: Uint8Array): void {
  if (!obj) return;

  if (obj instanceof PDFString) {
    const originalBytes = obj.asBytes();
    const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
    (obj as any).value = Array.from(encrypted).map((b: number) => String.fromCharCode(b)).join('');
  } else if (obj instanceof PDFHexString) {
    const originalBytes = obj.asBytes();
    const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
    (obj as any).value = bytesToHex(encrypted);
  } else if (obj instanceof PDFDict) {
    const entries = obj.entries();
    for (const [key, value] of entries) {
      const keyName = (key as any).asString();
      if (keyName !== '/Length' && keyName !== '/Filter' && keyName !== '/DecodeParms') {
        encryptStringsInObject(value, objectNum, generationNum, encryptionKey);
      }
    }
  } else if (obj instanceof PDFArray) {
    const array = obj.asArray();
    for (const element of array) {
      encryptStringsInObject(element, objectNum, generationNum, encryptionKey);
    }
  }
}

// Compute PDF Standard Permission Bits
export function computePermissionFlags(
  allowPrint: boolean,
  allowCopy: boolean,
  allowEdit: boolean
): number {
  let flags = 0xFFFFFFFC; // start with all allowed
  if (!allowPrint) {
    flags &= ~4;    // Print flag
    flags &= ~2048; // High-res print flag
  }
  if (!allowCopy) {
    flags &= ~16;   // Extract/Copy flag
  }
  if (!allowEdit) {
    flags &= ~8;    // Modify contents flag
    flags &= ~32;   // Annotations flag
    flags &= ~256;  // Fill forms flag
    flags &= ~1024; // Assemble document flag
  }
  return flags;
}

// TypeScript version of client-side PDF encryption
export async function encryptPDF(
  pdfBytes: Uint8Array,
  userPassword: string,
  ownerPassword: string | null = null,
  permissions = 0xFFFFFFFC
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    const context = pdfDoc.context;
    let fileId: Uint8Array;
    const trailer = context.trailerInfo;
    const idArray = trailer.ID;
    
    if (idArray && Array.isArray(idArray) && idArray.length > 0) {
      const idString = idArray[0].toString();
      const hexStr = idString.replace(/^<|>$/g, '');
      fileId = hexToBytes(hexStr);
    } else {
      const randomBytes = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 16; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      fileId = randomBytes;
      const idHex1 = PDFHexString.of(bytesToHex(fileId));
      const idHex2 = PDFHexString.of(bytesToHex(fileId));
      (trailer as any).ID = [idHex1, idHex2];
    }
    
    const ownerKey = computeOwnerKey(ownerPassword, userPassword);
    const encryptionKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileId);
    const userKey = computeUserKey(encryptionKey, fileId);
    
    const indirectObjects = context.enumerateIndirectObjects();
    
    for (const [ref, obj] of indirectObjects) {
      const objectNum = ref.objectNumber;
      const generationNum = ref.generationNumber || 0;

      if (obj instanceof PDFDict) {
        const filter = obj.get(PDFName.of('Filter'));
        if (filter && (filter as any).asString() === '/Standard') {
          continue;
        }
      }

      if (obj instanceof PDFRawStream && obj.dict) {
        const type = obj.dict.get(PDFName.of('Type'));
        if (type) {
          const typeName = type.toString();
          if (typeName === '/XRef' || typeName === '/Sig') {
            continue;
          }
        }
      }

      if (obj instanceof PDFRawStream) {
        const streamData = obj.contents;
        const encrypted = encryptObject(streamData, objectNum, generationNum, encryptionKey);
        (obj as any).contents = encrypted;
        if (obj.dict) {
          encryptStringsInObject(obj.dict, objectNum, generationNum, encryptionKey);
        }
      }

      if (!(obj instanceof PDFRawStream)) {
        encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
      }
    }
    
    const encryptDict = context.obj({
      Filter: PDFName.of('Standard'),
      V: PDFNumber.of(2),
      R: PDFNumber.of(3),
      Length: PDFNumber.of(128),
      P: PDFNumber.of(permissions),
      O: PDFHexString.of(bytesToHex(ownerKey)),
      U: PDFHexString.of(bytesToHex(userKey))
    });
    
    const encryptRef = context.register(encryptDict);
    (trailer as any).Encrypt = encryptRef;
    
    const encryptedBytes = await pdfDoc.save({
      useObjectStreams: false
    });
    
    return encryptedBytes;
  } catch (error: any) {
    console.error('PDF encryption error:', error);
    throw new Error(`Failed to encrypt PDF: ${error.message}`);
  }
}
