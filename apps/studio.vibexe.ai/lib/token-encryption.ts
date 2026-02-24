import {
	type CipherGCMTypes,
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import invariant from "tiny-invariant";

const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;
const V1_PREFIX = "enc:"; // Legacy v1 format: enc:<base64>
const V2_PREFIX = "enc:v2:"; // v2 format: enc:v2:<fingerprint>:<base64>

export class EncryptionKeyMismatchError extends Error {
	constructor(expected: string, actual: string) {
		super(
			`Encryption key mismatch: token was encrypted with key [${expected}] but current key is [${actual}]. ` +
				`The TOKEN_ENCRYPTION_KEY may have been changed or rotated. Re-enter the value to re-encrypt with the current key.`,
		);
		this.name = "EncryptionKeyMismatchError";
	}
}

function getEncryptionKey(): Buffer {
	const key = process.env.TOKEN_ENCRYPTION_KEY;
	invariant(key, "TOKEN_ENCRYPTION_KEY is not set");
	const buffer = Buffer.from(key, "base64");
	invariant(buffer.length === 32, "TOKEN_ENCRYPTION_KEY must be 32 bytes");
	return buffer;
}

/** Returns first 8 hex chars of SHA-256(TOKEN_ENCRYPTION_KEY) as a fingerprint */
export function getKeyFingerprint(): string {
	const key = getEncryptionKey();
	return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

function isEncrypted(value: string): boolean {
	return value.startsWith(V1_PREFIX);
}

export function encryptToken(plaintext: string): string {
	const key = getEncryptionKey();
	const fingerprint = getKeyFingerprint();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	// v2 format: enc:v2:<fingerprint>:<base64(iv + authTag + encrypted)>
	const combined = Buffer.concat([iv, authTag, encrypted]);
	return `${V2_PREFIX}${fingerprint}:${combined.toString("base64")}`;
}

export function decryptToken(value: string): string {
	// Backward compatibility: return plaintext tokens as-is
	if (!isEncrypted(value)) {
		return value;
	}

	const key = getEncryptionKey();

	// Detect v2 format: enc:v2:<fingerprint>:<base64>
	if (value.startsWith(V2_PREFIX)) {
		const rest = value.slice(V2_PREFIX.length); // "<fingerprint>:<base64>"
		const colonIdx = rest.indexOf(":");
		if (colonIdx === -1) {
			throw new Error("Encrypted token is malformed: invalid v2 format");
		}
		const storedFingerprint = rest.slice(0, colonIdx);
		const currentFingerprint = getKeyFingerprint();
		if (storedFingerprint !== currentFingerprint) {
			throw new EncryptionKeyMismatchError(
				storedFingerprint,
				currentFingerprint,
			);
		}
		const data = Buffer.from(rest.slice(colonIdx + 1), "base64");
		return decryptData(key, data);
	}

	// Legacy v1 format: enc:<base64>
	const data = Buffer.from(value.slice(V1_PREFIX.length), "base64");
	return decryptData(key, data);
}

function decryptData(key: Buffer, data: Buffer): string {
	if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
		throw new Error(
			"Encrypted token is malformed: insufficient data for IV and auth tag",
		);
	}
	const iv = data.subarray(0, IV_LENGTH);
	const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);
	return decrypted.toString("utf-8");
}
