import { Hono } from "hono";
import { createKeyMiddleware } from "../middlewares/key.middleware";
import { HTTPException } from "hono/http-exception";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const createUploadController = () => {
  const app = new Hono();

  app.post("/", createKeyMiddleware(), async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      throw new HTTPException(400, {
        message: "No file uploaded or invalid file",
      });
    }

    try {
      const extension = path.extname(file.name);
      const filename = `${crypto.randomUUID()}${extension}`;
      const uploadDir = path.resolve("./media");

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      fs.writeFileSync(filePath, buffer);

      // Construct URL - using the server IP from index.ts or relative path
      // The frontend knows the base URL, so we can return a relative path or a flag
      // But for simplicity, let's return the filename and let the frontend build the URL
      
      const baseUrl = process.env.BASE_URL || "http://10.10.10.195:5001";
      const fileUrl = `${baseUrl}/media/${filename}`;

      return c.json({
        success: true,
        url: fileUrl,
        filename: filename,
        originalName: file.name
      });
    } catch (error) {
      console.error("Upload error:", error);
      throw new HTTPException(500, {
        message: "Failed to save file",
      });
    }
  });

  return app;
};
