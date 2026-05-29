import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
const r2Bucket = process.env.R2_BUCKET;
const r2Endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
const r2Client = r2Bucket && r2Endpoint && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    })
  : null;

export type StoredFile = {
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type DownloadedFile = {
  buffer: Buffer;
  contentType?: string;
};

function safeExtension(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext || ext.length > 12) return "";
  return ext.replace(/[^.\w-]/g, "");
}

export async function saveUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
  const fileKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExtension(file.originalname)}`;

  if (r2Client && r2Bucket) {
    await r2Client.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: Buffer.from(file.originalname).toString("base64")
      }
    }));

    return {
      fileKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    };
  }

  await fs.mkdir(uploadRoot, { recursive: true });
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
  const relative = path.relative(uploadRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file key");
  }
  return resolved;
}

export async function downloadStoredFile(fileKey: string): Promise<DownloadedFile> {
  if (r2Client && r2Bucket) {
    try {
      const response = await r2Client.send(new GetObjectCommand({ Bucket: r2Bucket, Key: fileKey }));
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error("R2 object body is empty");
      return {
        buffer: Buffer.from(bytes),
        contentType: response.ContentType
      };
    } catch (error: any) {
      if (!["NoSuchKey", "NotFound", "NoSuchBucket"].includes(error?.name)) throw error;
    }
  }

  return {
    buffer: await fs.readFile(resolveFileKey(fileKey))
  };
}

export async function deleteStoredFile(fileKey: string) {
  if (r2Client && r2Bucket) {
    await r2Client.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: fileKey })).catch((error: any) => {
      if (!["NoSuchKey", "NotFound"].includes(error?.name)) throw error;
    });
  }

  await fs.unlink(resolveFileKey(fileKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
