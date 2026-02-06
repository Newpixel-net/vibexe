import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

  import { Pool } from "pg";
  import { randomBytes } from "crypto";

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  export interface Session {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  function generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  export async function createSession(
    userId: string,
    options?: { ipAddress?: string; userAgent?: string; expiresInDays?: number }
  ): Promise<Session> {
    const expiresInDays = options?.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const token = generateToken();

    const result = await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at`,
      [userId, token, expiresAt, options?.ipAddress ?? null, options?.userAgent ?? null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  export async function getSessionByToken(token: string): Promise<Session | null> {
    const result = await pool.query(
      `SELECT id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at
       FROM sessions WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  export async function deleteSession(token: string): Promise<void> {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  export async function deleteUserSessions(userId: string): Promise<void> {
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }

  export async function extendSession(token: string, days: number = 7): Promise<void> {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await pool.query(
      "UPDATE sessions SET expires_at = $1, updated_at = NOW() WHERE token = $2",
      [expiresAt, token]
    );
  }

  export async function cleanupExpiredSessions(): Promise<number> {
    const result = await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
    return result.rowCount ?? 0;
  }
