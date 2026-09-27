import { betterAuth } from "better-auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ping } from "@/lib/ping";

function createAuth(d1: D1Database) {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: d1 as any, // D1 auto-detected by better-auth's kysely adapter
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            void ping("signup", { title: user.email, icon: "👋" });
          },
        },
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      },
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL || ""],
    pages: {
      signIn: "/login",
    },
    rateLimit: {
      enabled: false,
    },
  });
}

/** Lazy auth — resolves D1 from Cloudflare context at call time, never at module level. */
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as { AUTH_DB?: D1Database }).AUTH_DB;
  if (!d1) throw new Error("AUTH_DB D1 binding not found in env");
  return createAuth(d1);
}
