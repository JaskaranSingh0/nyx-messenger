const ECDH_ALGO = {
    name: "ECDH",
    namedCurve: "P-256"
};

const AES_ALGO = {
    name: "AES-GCM",
    length: 256
};

const HASH_ALGO = "SHA-256";

/**
 * Generates a new ECDH key pair for a session.
 */
export async function generateSessionKeyPair() {
    return await window.crypto.subtle.generateKey(
        ECDH_ALGO,
        true,
        ["deriveKey", "deriveBits"]
    );
}

/**
 * Derives a 256-bit AES key from ECDH key agreement.
 * @param {CryptoKey} privateKey 
 * @param {CryptoKey} publicKey 
 * @returns {Promise<ArrayBuffer>} raw shared secret (32 bytes)
 */
export async function deriveSharedSecret(privateKey, publicKey) {
    const bits = await window.crypto.subtle.deriveBits(
        {
            name: ECDH_ALGO.name,
            public: publicKey
        },
        privateKey,
        AES_ALGO.length
    );
    console.log("🔑 Derived shared secret (length):", bits.byteLength);
    return bits;
}

/**
 * Encrypts data using AES-GCM.
 * @param {ArrayBuffer} sharedSecret Raw 256-bit key
 * @param {string | ArrayBuffer} dataToEncrypt 
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
 */
export async function encryptMessage(sharedSecret, dataToEncrypt) {
    const key = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    let encoded;
    if (typeof dataToEncrypt === 'string') {
        encoded = new TextEncoder().encode(dataToEncrypt);
    } else if (dataToEncrypt instanceof ArrayBuffer) {
        encoded = new Uint8Array(dataToEncrypt); // binary
    } else {
        throw new Error('Data to encrypt must be a string or ArrayBuffer.');
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    console.log("📦 Encrypting", {
        dataLength: encoded.byteLength,
        iv
    });

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: AES_ALGO.name, iv },
        key,
        encoded
    );

    return { ciphertext, iv };
}

/**
 * Decrypts data using AES-GCM.
 * @param {ArrayBuffer} sharedSecret Raw 256-bit key
 * @param {ArrayBuffer} ciphertext 
 * @param {Uint8Array} iv 
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptMessage(sharedSecret, ciphertext, iv) {
    if (!(iv instanceof Uint8Array) || iv.length !== 12) {
        throw new Error("Invalid IV. Must be 12-byte Uint8Array.");
    }

    console.log("🔐 Decrypting message", {
        ciphertextLength: ciphertext.byteLength || ciphertext.length,
        iv
    });

    const key = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv
        },
        key,
        ciphertext
    );

    return decrypted; // Still ArrayBuffer
}

/**
 * Exports a public ECDH key to JWK for sharing.
 */
export async function exportPublicKey(publicKey) {
    return await window.crypto.subtle.exportKey(
        "jwk",
        publicKey
    );
}

/**
 * Imports a public ECDH key from a JWK.
 * @param {JsonWebKey} jwk 
 */
export async function importPublicKey(jwk) {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        ECDH_ALGO,
        true,
        []
    );
}

/**
 * Generates a random alphanumeric code (for pairing).
 */
export function generateRandomCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = window.crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i++) {
        result += characters[bytes[i] % characters.length];
    }
    return result;
}

/**
 * Overwrites sensitive buffers with 0s in-place.
 * @param {ArrayBuffer | Uint8Array} buffer 
 */
export function zeroFill(buffer) {
    if (buffer instanceof ArrayBuffer) {
        const view = new Uint8Array(buffer);
        view.fill(0);
    } else if (buffer instanceof Uint8Array) {
        buffer.fill(0);
    }
    // Memory is not actually freed (JS garbage collection),
    // but this prevents recovery in memory snapshots.
}
