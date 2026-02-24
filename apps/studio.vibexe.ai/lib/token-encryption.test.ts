import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import {
	EncryptionKeyMismatchError,
	decryptToken,
	encryptToken,
	getKeyFingerprint,
} from "./token-encryption";

describe("token-encryption", () => {
	const testKey = randomBytes(32).toString("base64");

	beforeEach(() => {
		process.env.TOKEN_ENCRYPTION_KEY = testKey;
	});

	test("encrypts and decrypts token correctly", () => {
		const plaintext = "gho_xxxxxxxxxxxxxxxxxxxx";
		const encrypted = encryptToken(plaintext);
		const decrypted = decryptToken(encrypted);

		expect(decrypted).toBe(plaintext);
	});

	test("encrypted token uses v2 format with fingerprint", () => {
		const encrypted = encryptToken("test-token");

		expect(encrypted.startsWith("enc:v2:")).toBe(true);
		// Format: enc:v2:<8-char-fingerprint>:<base64>
		const parts = encrypted.split(":");
		expect(parts.length).toBe(4);
		expect(parts[2]).toHaveLength(8);
	});

	test("same plaintext produces different ciphertext each time", () => {
		const plaintext = "same-token";
		const encrypted1 = encryptToken(plaintext);
		const encrypted2 = encryptToken(plaintext);

		expect(encrypted1).not.toBe(encrypted2);
		expect(decryptToken(encrypted1)).toBe(plaintext);
		expect(decryptToken(encrypted2)).toBe(plaintext);
	});

	test("decrypts plaintext tokens as-is for backward compatibility", () => {
		const plaintext = "gho_plaintext_token";
		const result = decryptToken(plaintext);

		expect(result).toBe(plaintext);
	});

	test("decrypts legacy v1 format tokens", () => {
		// Manually create a v1-style encrypted token (enc:<base64>)
		// by encrypting with v2 then stripping the v2 prefix parts
		const { createCipheriv } = require("node:crypto");
		const key = Buffer.from(testKey, "base64");
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", key, iv, {
			authTagLength: 16,
		});
		const encrypted = Buffer.concat([
			cipher.update("legacy-token", "utf8"),
			cipher.final(),
		]);
		const authTag = cipher.getAuthTag();
		const combined = Buffer.concat([iv, authTag, encrypted]);
		const v1Token = `enc:${combined.toString("base64")}`;

		expect(decryptToken(v1Token)).toBe("legacy-token");
	});

	test("throws EncryptionKeyMismatchError when key changes (v2 format)", () => {
		const encrypted = encryptToken("test-token");

		// Switch to a different key
		process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

		expect(() => decryptToken(encrypted)).toThrow(EncryptionKeyMismatchError);
	});

	test("throws error when decrypting tampered data", () => {
		const encrypted = encryptToken("test-token");
		const tampered = `${encrypted.slice(0, -4)}XXXX`;

		expect(() => decryptToken(tampered)).toThrow();
	});

	test("handles empty string", () => {
		const encrypted = encryptToken("");
		const decrypted = decryptToken(encrypted);

		expect(decrypted).toBe("");
	});

	test("handles unicode characters", () => {
		const plaintext = "token_日本語_🔐";
		const encrypted = encryptToken(plaintext);
		const decrypted = decryptToken(encrypted);

		expect(decrypted).toBe(plaintext);
	});

	test("handles long tokens", () => {
		const plaintext = "a".repeat(10000);
		const encrypted = encryptToken(plaintext);
		const decrypted = decryptToken(encrypted);

		expect(decrypted).toBe(plaintext);
	});

	describe("getKeyFingerprint", () => {
		test("returns 8-character hex string", () => {
			const fp = getKeyFingerprint();
			expect(fp).toHaveLength(8);
			expect(fp).toMatch(/^[0-9a-f]{8}$/);
		});

		test("returns same fingerprint for same key", () => {
			expect(getKeyFingerprint()).toBe(getKeyFingerprint());
		});

		test("returns different fingerprint for different key", () => {
			const fp1 = getKeyFingerprint();
			process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
			const fp2 = getKeyFingerprint();
			expect(fp1).not.toBe(fp2);
		});
	});

	describe("when encryption key is invalid", () => {
		test("throws error when encryption key is not set", () => {
			process.env.TOKEN_ENCRYPTION_KEY = "";

			expect(() => encryptToken("test")).toThrow(
				"TOKEN_ENCRYPTION_KEY is not set",
			);
		});

		test("throws error when encryption key is wrong length", () => {
			process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");

			expect(() => encryptToken("test")).toThrow(
				"TOKEN_ENCRYPTION_KEY must be 32 bytes",
			);
		});

		describe("when decryption key is invalid", () => {
			test("throws error when decrypting without key", () => {
				const encrypted = encryptToken("test-token");
				process.env.TOKEN_ENCRYPTION_KEY = "";

				expect(() => decryptToken(encrypted)).toThrow(
					"TOKEN_ENCRYPTION_KEY is not set",
				);
			});

			test("throws error when decrypting with wrong key length", () => {
				const encrypted = encryptToken("test-token");
				process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");

				expect(() => decryptToken(encrypted)).toThrow(
					"TOKEN_ENCRYPTION_KEY must be 32 bytes",
				);
			});
		});
	});
});
