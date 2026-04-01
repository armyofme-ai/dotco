/**
 * Storage provider abstraction.
 *
 * Supports three backends:
 *   1. Vercel Blob  – when BLOBPRO_READ_WRITE_TOKEN is set
 *   2. S3 / S3-compatible – when S3_BUCKET is set
 *   3. Local filesystem – fallback (UPLOAD_DIR, default "./uploads")
 *
 * Every function is safe to call from any backend; unknown URLs are silently
 * ignored during deletion so provider switches never break existing data.
 */

import { put as blobPut, del as blobDel } from "@vercel/blob";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

export type StorageProvider = "vercel-blob" | "s3" | "local";

export function getStorageProvider(): StorageProvider {
  if (process.env.BLOBPRO_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.S3_BUCKET) return "s3";
  return "local";
}

export function isStorageConfigured(): boolean {
  return getStorageProvider() !== "local" || !!process.env.UPLOAD_DIR;
}

// ---------------------------------------------------------------------------
// S3 helpers (lazily initialised)
// ---------------------------------------------------------------------------

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3) return _s3;

  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT; // optional, for MinIO / R2 / etc.

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set when S3_BUCKET is configured"
    );
  }

  _s3 = new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!endpoint, // required for MinIO / S3-compatible
  });

  return _s3;
}

function s3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not set");
  return bucket;
}

// Build the public URL for an S3 object.
function s3Url(key: string): string {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = s3Bucket();
  if (endpoint) {
    // S3-compatible: <endpoint>/<bucket>/<key>
    return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

// Extract the S3 key from a URL we previously generated.
function s3KeyFromUrl(url: string): string | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;

  // Custom endpoint: <endpoint>/<bucket>/<key>
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    const prefix = `${endpoint.replace(/\/+$/, "")}/${bucket}/`;
    if (url.startsWith(prefix)) return url.slice(prefix.length);
  }

  // Standard S3 URL: https://<bucket>.s3.<region>.amazonaws.com/<key>
  const stdPrefix = `https://${bucket}.s3.`;
  if (url.startsWith(stdPrefix)) {
    const idx = url.indexOf(".amazonaws.com/");
    if (idx !== -1) return url.slice(idx + ".amazonaws.com/".length);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UploadResult {
  url: string;
  pathname: string;
}

/**
 * Upload a file buffer. Returns the public URL and the stored pathname.
 *
 * @param pathname  Desired path (e.g. "photos/abc-file.jpg")
 * @param data      File contents
 * @param options   contentType is required; access defaults to "public"
 */
export async function uploadFile(
  pathname: string,
  data: Buffer | Uint8Array,
  options: { contentType: string }
): Promise<UploadResult> {
  const provider = getStorageProvider();
  // Ensure we have a Node Buffer for providers that require it
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (provider === "vercel-blob") {
    const blob = await blobPut(pathname, buf, {
      access: "public",
      contentType: options.contentType,
      token: process.env.BLOBPRO_READ_WRITE_TOKEN,
    });
    return { url: blob.url, pathname };
  }

  if (provider === "s3") {
    const key = pathname;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
        Body: buf,
        ContentType: options.contentType,
      })
    );
    return { url: s3Url(key), pathname: key };
  }

  // Local filesystem
  const type = options.contentType.startsWith("image/") ? "photos" : "audio";
  const dir = path.join(uploadDir(), type);
  await mkdir(dir, { recursive: true });

  const uniqueName = `${uuidv4()}-${path.basename(pathname)}`;
  const filePath = path.join(dir, uniqueName);
  await writeFile(filePath, buf);

  const url = `/uploads/${type}/${uniqueName}`;
  return { url, pathname: url };
}

/**
 * Delete a single file by its URL.
 * Silently ignores URLs that don't match the current provider.
 */
export async function deleteFile(url: string): Promise<void> {
  const provider = getStorageProvider();

  // Vercel Blob
  if (url.includes("blob.vercel-storage.com") && provider === "vercel-blob") {
    try {
      await blobDel(url, { token: process.env.BLOBPRO_READ_WRITE_TOKEN });
    } catch {
      console.warn("Failed to delete blob:", url);
    }
    return;
  }

  // S3
  if (provider === "s3") {
    const key = s3KeyFromUrl(url);
    if (key) {
      try {
        await getS3Client().send(
          new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key })
        );
      } catch {
        console.warn("Failed to delete S3 object:", url);
      }
    }
    return;
  }

  // Local
  if (url.startsWith("/uploads/")) {
    try {
      const filePath = path.join(uploadDir(), url.replace("/uploads/", ""));
      await unlink(filePath);
    } catch {
      console.warn("Failed to delete local file:", url);
    }
  }
}

/**
 * Delete multiple files by URL.
 * Groups S3 keys into a single batch delete for efficiency.
 */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const provider = getStorageProvider();

  // Vercel Blob – batch delete
  const blobUrls = urls.filter((u) => u.includes("blob.vercel-storage.com"));
  if (blobUrls.length > 0 && provider === "vercel-blob") {
    try {
      await blobDel(blobUrls, { token: process.env.BLOBPRO_READ_WRITE_TOKEN });
    } catch {
      console.warn("Failed to delete some blobs");
    }
  }

  // S3 – batch delete
  if (provider === "s3") {
    const keys = urls
      .map((u) => s3KeyFromUrl(u))
      .filter((k): k is string => k !== null);
    if (keys.length > 0) {
      try {
        await getS3Client().send(
          new DeleteObjectsCommand({
            Bucket: s3Bucket(),
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          })
        );
      } catch {
        console.warn("Failed to delete some S3 objects");
      }
    }
  }

  // Local
  if (provider === "local") {
    await Promise.allSettled(
      urls.filter((u) => u.startsWith("/uploads/")).map((u) => deleteFile(u))
    );
  }
}
