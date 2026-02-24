import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const derived = scryptSync(password, salt, KEY_LENGTH, {
		N: SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
	});
	return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	const [saltHex, keyHex] = hash.split(":");
	if (!saltHex || !keyHex) return false;
	const salt = Buffer.from(saltHex, "hex");
	const storedKey = Buffer.from(keyHex, "hex");
	const derived = scryptSync(password, salt, KEY_LENGTH, {
		N: SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
	});
	return timingSafeEqual(derived, storedKey);
}
