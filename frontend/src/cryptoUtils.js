// frontend/src/cryptoUtils.js

const ECDH_ALGO = {
    name: "ECDH",
    namedCurve: "P-256"
};

const AES_ALGO = {
    name: "AES-GCM",
    length: 256
};

const HASH_ALGO = "SHA-256";

export async function generateSessionKeyPair() {
    return await window.crypto.subtle.generateKey(
        ECDH_ALGO,
        true,
        ["deriveKey", "deriveBits"]
    );
}

export async function deriveSharedSecret(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
        { name: ECDH_ALGO.name, public: publicKey },
        privateKey,
        AES_ALGO,
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts data (string or ArrayBuffer) using AES-GCM.
 * @param {CryptoKey} key The symmetric AES-GCM key.
 * @param {string | ArrayBuffer} dataToEncrypt The data to encrypt (text or binary).
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
 */
export async function encryptMessage(key, dataToEncrypt) {
    let encoded;
    if (typeof dataToEncrypt === 'string') {
        encoded = new TextEncoder().encode(dataToEncrypt);
    } else if (dataToEncrypt instanceof ArrayBuffer) {
        encoded = new Uint8Array(dataToEncrypt); // Use Uint8Array view for encryption
    } else {
        throw new Error('Data to encrypt must be string or ArrayBuffer.');
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: AES_ALGO.name, iv: iv },
        key,
        encoded
    );

    return { ciphertext, iv };
}

/**
 * Decrypts a message using AES-GCM.
 * @param {CryptoKey} key The symmetric AES-GCM key.
 * @param {ArrayBuffer} ciphertext The encrypted message data.
 * @param {Uint8Array} iv The Initialization Vector used during encryption.
 * @returns {Promise<ArrayBuffer>} The decrypted data as an ArrayBuffer.
 */
export async function decryptMessage(key, ciphertext, iv) {
    const decrypted = await window.crypto.subtle.decrypt(
        { name: AES_ALGO.name, iv: iv },
        key,
        ciphertext
    );
    return decrypted; // Will be an ArrayBuffer
}

export async function exportPublicKey(publicKey) {
    return await window.crypto.subtle.exportKey(
        "jwk",
        publicKey
    );
}

export async function importPublicKey(jwk) {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        ECDH_ALGO,
        true,
        []
    );
}

export function generateRandomCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = window.crypto.getRandomValues(new Uint8Array(length));
    bytes.forEach(byte => {
        result += characters[byte % characters.length];
    });
    return result;
}

export function zeroFill(buffer) {
    if (buffer instanceof ArrayBuffer) {
        const view = new Uint8Array(buffer);
        view.fill(0);
    } else if (buffer instanceof Uint8Array) {
        buffer.fill(0);
    }
    // Note: This does not remove the object from memory, just overwrites its content.
    // JS garbage collection determines when it's fully freed.
}