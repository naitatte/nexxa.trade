import type { FastifyInstance } from "fastify";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { auth } from "../auth/auth";
import { asyncHandler } from "../../utils/async-handler";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORAGE_ROOT = path.resolve(CURRENT_DIR, "../../../storage");
const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : DEFAULT_STORAGE_ROOT;
const PROFILE_PICTURES_DIR = path.join(STORAGE_ROOT, "profile-pictures");
const PROFILE_PICTURES_ROUTE = "/storage/profile-pictures";

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function buildBaseUrl(request: { headers: Record<string, string | string[] | undefined> }) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || "http";
  const host = Array.isArray(request.headers.host)
    ? request.headers.host[0]
    : request.headers.host || "localhost";
  return `${protocol}://${host}`;
}

export function registerUploadRoutes(app: FastifyInstance) {
  app.post(
    "/api/uploads/profile-picture",
    asyncHandler(async (request, reply) => {
      const session = await auth.api.getSession({
        headers: request.headers as Record<string, string>,
      });

      if (!session?.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "Missing file" });
      }

      const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype);
      if (!extension) {
        return reply.status(400).send({ error: "Unsupported image type" });
      }

      await fs.mkdir(PROFILE_PICTURES_DIR, { recursive: true });

      const safeName = `${session.user.id}-${Date.now()}-${randomUUID()}${extension}`;
      const targetPath = path.join(PROFILE_PICTURES_DIR, safeName);
      const buffer = await file.toBuffer();

      await fs.writeFile(targetPath, buffer);

      const baseUrl = buildBaseUrl(request);
      const url = `${baseUrl}${PROFILE_PICTURES_ROUTE}/${safeName}`;

      reply.send({ url });
    })
  );

  app.get(
    `${PROFILE_PICTURES_ROUTE}/:filename`,
    asyncHandler(async (request, reply) => {
      const { filename } = request.params as { filename: string };
      const safeName = path.basename(filename);
      if (safeName !== filename) {
        return reply.status(400).send({ error: "Invalid filename" });
      }

      const filePath = path.join(PROFILE_PICTURES_DIR, safeName);
      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({ error: "File not found" });
      }

      const ext = path.extname(safeName).toLowerCase();
      const contentType =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
          ? "image/gif"
          : "application/octet-stream";

      reply.type(contentType);
      return reply.send(createReadStream(filePath));
    })
  );
}
