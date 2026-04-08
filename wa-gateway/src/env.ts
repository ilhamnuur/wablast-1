import "dotenv/config";
import { z } from "zod";

export const env = z
  .object({
    NODE_ENV: z.enum(["DEVELOPMENT", "PRODUCTION"]).default("DEVELOPMENT"),
    KEY: z.string().default(""),
    PORT: z
      .string()
      .default("5001")
      .transform((e) => Number(e)),
    WEBHOOK_BASE_URL: z.string().optional(),
    // Database config
    DB_HOST: z.string().default("10.10.10.195"),
    DB_PORT: z
      .string()
      .default("5432")
      .transform((e) => Number(e)),
    DB_NAME: z.string().default("whatsapp"),
    DB_USER: z.string().default("casaos"),
    DB_PASSWORD: z.string().default("casaos"),
    ALLOW_SELF_MESSAGES: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .parse(process.env);

// Log configuration (without password)
console.log("🔧 Environment Configuration:");
console.log("ALLOW_SELF_MESSAGES:", env.ALLOW_SELF_MESSAGES);
console.log("NODE_ENV:", env.NODE_ENV);
console.log("PORT:", env.PORT);
console.log("DB_HOST:", env.DB_HOST);
console.log("DB_PORT:", env.DB_PORT);
console.log("DB_NAME:", env.DB_NAME);
console.log("DB_USER:", env.DB_USER);
console.log("DB_PASSWORD:", "***hidden***");
