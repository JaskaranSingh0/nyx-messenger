// frontend/src/cryptoUtils.js

// Using Curve25519 for ECDH as it's the recommended curve for Signal-like protocols.
// However, Web Crypto API directly supports P-256, P-384, P-521.
// For true Curve25519, you might need a library like libsodium.js if direct browser support isn't available.
// For now, let's use P-256, as it's well-supported and secure.
const ECDH_ALGO = {
    name: "ECDH",
    namedCurve: "P-256" // P-256 is the standard elliptic curve for Web Crypto API
};

const AES_ALGO = {
    name: "AES-GCM", // AES-GCM is recommended for authenticated encryption
    length: 256       // 256-bit key
};

const HASH_ALGO = "SHA-256"; // For hashing public keys or other data

/**
 * Generates a new ECDH key pair for a session.
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateSessionKeyPair() {
    return await window.crypto.subtle.generateKey(
        ECDH_ALGO,
        true, // extractable
        ["deriveKey", "deriveBits"]
    );
}

/**
 * Derives a shared symmetric key from two ECDH key pairs (own private, peer's public).
 * This is the core of Diffie-Hellman key exchange.
 * @param {CryptoKey} privateKey Our own private ECDH key.
 * @param {CryptoKey} publicKey Peer's public ECDH key.
 * @returns {Promise<CryptoKey>} Derived symmetric key (AES-GCM).
 */
export async function deriveSharedSecret(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
        { name: ECDH_ALGO.name, public: publicKey },
        privateKey,
        AES_ALGO,
        true, // extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a text message using AES-GCM.
 * @param {CryptoKey} key The symmetric AES-GCM key.
 * @param {string} plaintext The message to encrypt.
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
 */
export async function encryptMessage(key, plaintext) {
    const encoded = new TextEncoder().encode(plaintext);
    // IV (Initialization Vector) must be unique for each encryption with the same key
    // For AES-GCM, 12 bytes (96 bits) is the standard recommendation.
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
 * @returns {Promise<string>} The decrypted plaintext.
 */
export async function decryptMessage(key, ciphertext, iv) {
    const decrypted = await window.crypto.subtle.decrypt(
        { name: AES_ALGO.name, iv: iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * Exports a public key to a shareable format (JWK - JSON Web Key).
 * @param {CryptoKey} publicKey
 * @returns {Promise<JsonWebKey>}
 */
export async function exportPublicKey(publicKey) {
    return await window.crypto.subtle.exportKey(
        "jwk",
        publicKey
    );
}

/**
 * Imports a public key from a JWK format.
 * @param {JsonWebKey} jwk
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(jwk) {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        ECDH_ALGO,
        true, // extractable
        [] // Public keys are not used for encrypt/decrypt directly
    );
}

/**
 * Generates a unique, short code (for QR/alphanumeric code).
 * This is NOT for crypto purposes, but for identity.
 * @param {number} length
 * @returns {string}
 */
export function generateRandomCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = window.crypto.getRandomValues(new Uint8Array(length));
    bytes.forEach(byte => {
        result += characters[byte % characters.length];
    });
    return result;
}

/**
 * Zeros out ArrayBuffer content for ephemeral data.
 * While not guaranteed by the JS engine/GC, it's a best effort.
 * @param {ArrayBuffer} buffer
 */
export function zeroFill(buffer) {
    const view = new Uint8Array(buffer);
    view.fill(0);
}