import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { Pool } from "@neondatabase/serverless";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { sql } from "./db.js";

neonConfig.webSocketConstructor = ws;

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  connectionString: `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}?sslmode=require`,
});

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3001",
    process.env.CLIENT_URL,
  ].filter(Boolean),
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      httpOnly: true,
    },
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/github`,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (betterAuthUser) => {
          console.log("🧑 New user created by Better Auth:", betterAuthUser);
          const nameParts = (betterAuthUser.name || "").trim().split(" ");
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts.slice(1).join(" ") || "Unknown";
          const role = betterAuthUser.role || "user";
          await sql`
            INSERT INTO users (auth_id, email, first_name, last_name, role)
            VALUES (${betterAuthUser.id}, ${betterAuthUser.email}, ${firstName}, ${lastName}, ${role})
            ON CONFLICT (email) DO NOTHING
          `;
        },
      },
    },
  },
});

export const getAuthSession = async (headers) => {
  return await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
};

export const requireAuth = async (req, res, next) => {
  try {
    const session = await getAuthSession(req.headers);
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
    req.authUser = session.user;
    next();
  } catch (err) {
    console.error("❌ requireAuth error:", err);
    return res.status(500).json({ error: "Auth check failed." });
  }
};
