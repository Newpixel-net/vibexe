import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSiteOrigin, isValidReturnUrl } from "@/app/(auth)/lib";
import { db, oauthCredentials, users, type UserId } from "@/db";
import { logger } from "@/lib/logger";
import { encryptToken } from "@/lib/token-encryption";
import { initializeAccount, type OAuthProvider } from "@/services/accounts";
import { createSession } from "@/lib/session-store";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const SESSION_COOKIE_NAME = "giselle-session";

function isValidOAuthProvider(provider: string): provider is OAuthProvider {
  return provider === "github" || provider === "google";
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  refresh_token?: string;
}

interface GitHubUser {
  id: number;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  if (provider === "github") {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    return response.json();
  } else {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    return response.json();
  }
}

async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<{ id: string; email: string; name: string | null }> {
  if (provider === "github") {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user: GitHubUser = await userRes.json();
    
    let email = user.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) { const primary = emails.find((e: any) => e.primary && e.verified);
      email = primary?.email || emails[0]?.email || ""; }
    }
    
    return { id: String(user.id), email: email || "", name: user.name };
  } else {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user: GoogleUser = await res.json();
    return { id: user.id, email: user.email, name: user.name };
  }
}

function handleRedirect(path: string, queryString?: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const redirectPath = queryString
    ? `${normalizedPath}?${queryString}`
    : normalizedPath;
  return NextResponse.redirect(`${getSiteOrigin()}${redirectPath}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params;
  const { searchParams, origin } = new URL(request.url);
  
  if (!isValidOAuthProvider(providerParam)) {
    return new Response(`Invalid provider: ${providerParam}`, { status: 400 });
  }
  const provider: OAuthProvider = providerParam;
  
  logger.debug({ searchParams, origin, url: request.url }, "OAuth callback");
  
  const nextParam = searchParams.get("next") || searchParams.get("state");
  const next = isValidReturnUrl(nextParam) ? nextParam : "/";
  
  const error = searchParams.get("error");
  if (error) {
    const errorDescription = searchParams.get("error_description");
    return handleRedirect(next, `authError=${encodeURIComponent(error)}: ${errorDescription}`);
  }
  
  const code = searchParams.get("code");
  if (!code) {
    return new Response("No code provided", { status: 400 });
  }
  
  try {
    const redirectUri = `${getSiteOrigin()}/auth/callback/${provider}`;
    
    const tokenData = await exchangeCodeForToken(provider, code, redirectUri);
    if (!tokenData.access_token) {
      logger.error({ tokenData }, "Failed to get access token");
      return handleRedirect(next, "authError=Failed to authenticate");
    }
    
    const userInfo = await fetchUserInfo(provider, tokenData.access_token);
    logger.debug({ userInfo }, "Got user info from provider");
    
    // Find or create user
    let dbUser = await db
      .select()
      .from(users)
      .where(eq(users.email, userInfo.email))
      .limit(1)
      .then((rows) => rows[0]);
    
    if (!dbUser) {
      const [newUser] = await db
        .insert(users)
        .values({ id: `usr_${crypto.randomUUID().replace(/-/g, "")}` as UserId, email: userInfo.email, displayName: userInfo.name || null, avatarUrl: null })
        .returning();
      dbUser = newUser;
//       await initializeAccount({ userId: dbUser.id });
      logger.debug({ userId: dbUser.id }, "Created new user");
    }
    
    // Store OAuth credentials
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : null;
    
    await db
      .insert(oauthCredentials)
      .values({
        userId: dbUser.dbId,
        provider,
        providerAccountId: userInfo.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      })
      .onConflictDoUpdate({
        target: [oauthCredentials.userId, oauthCredentials.provider, oauthCredentials.providerAccountId],
        set: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          updatedAt: new Date(),
        },
      });
    
    // Create session
    const session = await createSession(dbUser.id, {
      ipAddress: request.headers.get("x-forwarded-for") || "",
      userAgent: request.headers.get("user-agent") || "",
    });
    
    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    logger.debug({ userId: dbUser.id }, "Login successful");
    return handleRedirect(next);
    
  } catch (err) {
    logger.error({ err }, "OAuth callback error");
    return handleRedirect(next, "authError=Authentication failed");
  }
}

