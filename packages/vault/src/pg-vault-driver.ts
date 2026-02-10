import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { VaultDriver } from "./types";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "vault:";

interface PgVaultDriverConfig {
	encryptionKey: string;
}

export function pgVaultDriver(config: PgVaultDriverConfig): VaultDriver {
	function getKey(): Buffer {
		const buffer = Buffer.from(config.encryptionKey, "base64");
		if (buffer.length !== 32) {
			throw new Error(
				"TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)",
			);
		}
		return buffer;
	}

	return {
		async encrypt(plaintext, _options): Promise<string> {
			const key = getKey();
			const iv = randomBytes(IV_LENGTH);
			const cipher = createCipheriv(ALGORITHM, key, iv, {
				authTagLength: AUTH_TAG_LENGTH,
			});
			const encrypted = Buffer.concat([
				cipher.update(plaintext, "utf8"),
				cipher.final(),
			]);
			const authTag = cipher.getAuthTag();
			const combined = Buffer.concat([iv, authTag, encrypted]);
			return `${PREFIX}${combined.toString("base64")}`;
		},

		async decrypt(ciphertext: string): Promise<string> {
			if (!ciphertext.startsWith(PREFIX)) {
				return ciphertext;
			}
			const key = getKey();
			const data = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
			if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
				throw new Error("Encrypted vault data is malformed");
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
		},
	};
}
