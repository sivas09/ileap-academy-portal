import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? "uploads");

export type StoredFile = {
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

function safeExtension(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext || ext.length > 12) return "";
  return ext.replace(/[^.\w-]/g, "");
}

export async function saveUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
  await fs.mkdir(uploadRoot, { recursive: true });
  const fileKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExtension(file.originalname)}`;
  const destination = path.join(uploadRoot, fileKey);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, file.buffer);

  return {
    fileKey,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  };
}

export function resolveFileKey(fileKey: string) {
  const resolved = path.resolve(uploadRoot, fileKey);
  if (!resolved.startsWith(uploadRoot)) {
    throw new Error("Invalid file key");
  }
  return resolved;
}

export async function deleteStoredFile(fileKey: string) {
  const resolved = resolveFileKey(fileKey);
  await fs.unlink(resolved).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
