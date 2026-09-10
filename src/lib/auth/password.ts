import {
  randomBytes,
  type ScryptOptions,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

// promisify kehilangan overload scrypt yang menerima options, jadi bentuknya
// ditegaskan ulang di sini.
const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// Parameter scrypt mengikuti anjuran OWASP untuk N = 2^15. Nilainya ikut
// disimpan bersama hash supaya kata sandi lama tetap bisa diperiksa ketika
// parameternya dinaikkan di kemudian hari.
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

async function deriveKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return derive(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEMORY,
  });
}

/** Menghasilkan kata sandi teracak berisi parameter, salt, dan hasil turunannya. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(
    password,
    salt,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
  );

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Mencocokkan kata sandi terhadap bentuk teracaknya. Perbandingan dilakukan
 * dalam waktu tetap, dan bentuk simpanan yang rusak dianggap tidak cocok alih-
 * alih melempar kesalahan, supaya kegagalan tidak membocorkan apa pun.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization)
  ) {
    return false;
  }

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const actual = await deriveKey(
    password,
    salt,
    cost,
    blockSize,
    parallelization,
  );
  return timingSafeEqual(actual, expected);
}
