/**
 * Cloudflare R2 Storage Client
 *
 * Uses AWS SDK for S3-compatible API with Cloudflare R2
 * Provides presigned URLs for secure file uploads and downloads
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const r2Logger = logger.child({ module: "r2" });


// File type magic bytes for validation
const FILE_SIGNATURES: Record<string, Buffer> = {
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  epub: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK.. (ZIP-based)
  zip: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK..
  mp3: Buffer.from([0x49, 0x44, 0x33]), // ID3 (MP3 with ID3 tag)
  mp3_ff: Buffer.from([0xFF, 0xFB]), // MP3 sync word
};

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
  region?: string;
}

interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  expiresIn?: number; // Seconds for presigned URL
}

interface PresignedUrlOptions {
  expiresIn?: number; // Seconds, default 3600 (1 hour)
}

/**
 * Get R2 configuration from database or environment
 */
export async function getR2Config(): Promise<R2Config | null> {
  try {
    // Try database first
    const settings = await db.platformSettings.findFirst({
      select: {
        r2AccountId: true,
        r2AccessKeyId: true,
        r2SecretAccessKey: true,
        r2BucketName: true,
        r2PublicDomain: true,
        r2Region: true,
        r2Enabled: true,
      },
    });

    if (settings?.r2Enabled && settings.r2AccountId && settings.r2AccessKeyId && settings.r2SecretAccessKey && settings.r2BucketName) {
      return {
        accountId: settings.r2AccountId,
        accessKeyId: settings.r2AccessKeyId,
        secretAccessKey: settings.r2SecretAccessKey,
        bucketName: settings.r2BucketName,
        publicDomain: settings.r2PublicDomain || undefined,
        region: settings.r2Region || "auto",
      };
    }

    // Fall back to environment variables
    const envConfig = {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      publicDomain: process.env.R2_PUBLIC_DOMAIN,
      region: process.env.R2_REGION || "auto",
    };

    if (envConfig.accountId && envConfig.accessKeyId && envConfig.secretAccessKey && envConfig.bucketName) {
      return envConfig as R2Config;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create S3 client configured for Cloudflare R2
 */
export function createR2Client(config: R2Config): S3Client {
  // Validate config before creating client
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    throw new Error("R2 configuration incomplete - missing required credentials");
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: config.region || "auto",
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Disable the AWS SDK v3.730+ default request checksum injection.
    // Without this, the SDK adds `x-amz-checksum-crc32` and
    // `x-amz-sdk-checksum-algorithm: CRC32` to every PutObjectCommand
    // and bakes them into the presigned URL's query string. The browser
    // is then required to send those headers on the PUT, and R2 must
    // both accept them on the request AND echo Access-Control-Allow-
    // Headers covering them. R2's CORS *does* allow the headers
    // (verified via direct OPTIONS probe), but Firefox's preflight
    // still fails as "CORS request did not succeed, Status code:
    // (null)" -- which usually means the actual response lacked the
    // expected CORS echo or the SDK-added checksum header was rejected
    // mid-handshake. Either way, R2 doesn't need or use these
    // checksums; turning them off makes presigned PUTs go through the
    // way they always did on SDK <3.730.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    // Force path-style URLs (https://<acct>.r2.cloudflarestorage.com/<bucket>/<key>)
    // instead of the SDK's default virtual-host style
    // (https://<bucket>.<acct>.r2.cloudflarestorage.com/<key>). Both are
    // valid on R2 but they're DIFFERENT HOSTNAMES, so they're different
    // CORS scopes. The R2 dashboard's CORS configuration applies to the
    // path-style hostname; presigned PUTs to the virtual-host hostname
    // were failing the browser's CORS preflight with no useful status
    // ("CORS request did not succeed", reported as "Network error" in
    // the upload UI). Symptom matched verbatim with a creator's
    // DevTools trace -- path-style probe returned 204 + correct
    // Allow-Origin, virtual-host probe blew up the preflight.
    //
    // forcePathStyle aligns the signed URL's hostname with the only
    // CORS-configured one, so the browser's preflight succeeds and
    // the PUT goes through.
    forcePathStyle: true,
  });
}

/**
 * R2 Storage Manager class
 */
export class R2Storage {
  private client: S3Client;
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
    this.client = createR2Client(config);
  }

  /**
   * Generate presigned URL for file upload.
   *
   * IMPORTANT: We deliberately do NOT include ContentType on the signed
   * PutObjectCommand. The SigV4 signature is computed over every header
   * declared on the command, so a signed ContentType means the browser
   * MUST PUT with that exact Content-Type header verbatim -- otherwise
   * R2 rejects with SignatureDoesNotMatch and the browser surfaces it
   * as a generic "Network error" with no useful response body.
   *
   * In practice this bites real users constantly because the browser
   * derives the PUT's Content-Type from the File object, and File.type
   * varies by OS + extension:
   *   - Windows sometimes hands ".zip" -> "application/x-zip-compressed"
   *     when our route signed "application/zip"
   *   - ".cbz"/".cbr"/".epub" -> "" (empty) -> browser falls back to
   *     "application/octet-stream" instead of the signed value
   *   - Drag-and-drop vs <input type="file"> can produce different
   *     File.type values for the same file on the same OS
   *
   * Tradeoff for omitting it: zero. We already track mimeType in the
   * DigitalFile/MediaFile DB row independently of what R2 has stored on
   * the object, and the download path (getDownloadUrl + serve route)
   * sets the Content-Type from our row, not from R2's object metadata.
   *
   * If a caller needs the object's Content-Type to be authoritative
   * (e.g. for direct R2 public-URL serving), pin it via the
   * `metadata` field instead, which is also signed but doesn't get
   * compared against the request's literal Content-Type header.
   */
  async getUploadUrl(
    key: string,
    options: UploadOptions = {}
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Metadata: options.metadata,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: options.expiresIn || 3600,
        // Signing options.contentType into the URL would force the
        // browser's PUT to match it exactly -- see the docblock above.
        unhoistableHeaders: new Set(),
      });
    } catch (error) {
      r2Logger.error({ err: error }, "R2 getUploadUrl error:");
      // Re-throw with more context
      throw new Error(`Failed to generate presigned upload URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate presigned URL for file download
   */
  async getDownloadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: options.expiresIn || 3600,
      });
    } catch (error) {
      throw new Error(`Failed to generate download URL for key "${key}": ${String(error)}`);
    }
  }

  /**
   * Upload file directly (for server-side uploads)
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    options: UploadOptions = {}
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: body,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    await this.client.send(command);
  }

  /**
   * Download file content directly
   */
  async getFile(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      // Convert readable stream to buffer
      const chunks: Uint8Array[] = [];
      const body = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      r2Logger.error({ err: error }, `[R2] Failed to get file ${key}:`);
      return null;
    }
  }

  /**
   * Start a multipart upload. Returns the uploadId the client needs to
   * reference for every UploadPart call and the final
   * CompleteMultipartUpload. Used for files >100MB where a single PUT
   * is too fragile across residential / CGNAT networks (long-lived
   * TCP connections get idle-killed, browser memory pressure builds,
   * etc.) -- multipart breaks the file into discrete short PUTs that
   * can each be retried independently.
   */
  async createMultipartUpload(
    key: string,
    options: UploadOptions = {}
  ): Promise<{ uploadId: string }> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Metadata: options.metadata,
    });
    const response = await this.client.send(command);
    if (!response.UploadId) {
      throw new Error("R2 did not return UploadId from CreateMultipartUpload");
    }
    return { uploadId: response.UploadId };
  }

  /**
   * Server-side upload of a single multipart part. Used when the
   * browser can't reach R2 directly (CORS, residential ISP /
   * corporate firewall blocking r2.cloudflarestorage.com, etc.). The
   * client POSTs each chunk to our server which forwards it here.
   * Returns the part's ETag so the client can pass it into
   * completeMultipartUpload.
   */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer
  ): Promise<{ etag: string }> {
    const command = new UploadPartCommand({
      Bucket: this.config.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
      ContentLength: body.length,
    });
    const response = await this.client.send(command);
    if (!response.ETag) {
      throw new Error("R2 did not return ETag from UploadPart");
    }
    return { etag: response.ETag };
  }

  /**
   * Presigned URL for uploading a single part. Each part is its own
   * short PUT from the browser; the client collects the per-part ETag
   * R2 returns and passes them all to completeMultipartUpload.
   *
   * NOTE: ETag is exposed to JavaScript only if the bucket CORS rule
   * has `Access-Control-Expose-Headers: ETag`. That's set by
   * applyDefaultCors() below; run it once after deploy.
   */
  async getUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.config.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return await getSignedUrl(this.client, command, {
      expiresIn,
      // Same reason as getUploadUrl -- don't bake any non-host headers
      // into the signed URL; the browser's PUT only needs to match the
      // host signature.
      unhoistableHeaders: new Set(),
    });
  }

  /**
   * Finalize a multipart upload. R2 stitches the parts in the
   * specified order and the object becomes readable as a single
   * object at `key`. Parts MUST be sorted by partNumber ascending.
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.config.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    });
    await this.client.send(command);
  }

  /**
   * Abort a multipart upload and free the parts already uploaded.
   * Safe to call multiple times; R2 returns success if the upload was
   * already gone.
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.config.bucketName,
      Key: key,
      UploadId: uploadId,
    });
    try {
      await this.client.send(command);
    } catch (err) {
      r2Logger.warn({ err: String(err), key, uploadId }, "abortMultipartUpload failed (non-fatal)");
    }
  }

  /**
   * Install the bucket CORS rules we need for browser uploads:
   *   - allow PUT/POST/GET/DELETE/HEAD from the public app origin
   *   - allow `Content-Type` request header (and `If-*` for resumable
   *     retries)
   *   - EXPOSE the `ETag` response header so multipart upload clients
   *     can read it from JS and feed it into CompleteMultipartUpload.
   *     Without this, multipart uploads silently fail at the finalize
   *     step because the client has no ETags to send.
   *
   * Idempotent -- PutBucketCors replaces the entire rule set.
   */
  async applyDefaultCors(allowedOrigins: string[]): Promise<void> {
    const command = new PutBucketCorsCommand({
      Bucket: this.config.bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedHeaders: ["content-type", "if-match", "if-none-match"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
    await this.client.send(command);
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType?: string;
    lastModified?: Date;
    metadata?: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch {
      return null;
    }
  }

  /**
   * List files with optional prefix
   */
  async listFiles(prefix?: string, maxKeys = 1000): Promise<{
    key: string;
    size: number;
    lastModified?: Date;
  }[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await this.client.send(command);
    return (response.Contents || []).map((obj: { Key?: string; Size?: number; LastModified?: Date }) => ({
      key: obj.Key || "",
      size: obj.Size || 0,
      lastModified: obj.LastModified,
    }));
  }

  /**
   * Calculate total storage used by a project
   */
  async getProjectStorageUsed(projectId: string): Promise<number> {
    const files = await this.listFiles(`digital-rewards/${projectId}/`);
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Test connection to R2
   */
  async testConnection(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        MaxKeys: 1,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get R2 storage instance (singleton pattern for default config)
 */
let defaultStorage: R2Storage | null = null;

export async function getR2Storage(): Promise<R2Storage | null> {
  if (defaultStorage) return defaultStorage;

  const config = await getR2Config();
  if (!config) return null;

  defaultStorage = new R2Storage(config);
  return defaultStorage;
}

/**
 * Validate file type by checking magic bytes
 */
export function validateFileType(
  buffer: Buffer,
  allowedTypes: string[]
): { valid: boolean; detectedType?: string } {
  for (const type of allowedTypes) {
    const signature = FILE_SIGNATURES[type];
    if (signature && buffer.subarray(0, signature.length).equals(signature)) {
      return { valid: true, detectedType: type };
    }

    // Special case for MP3 files that may start with 0xFF
    if (type === "mp3") {
      const mp3AltSignature = FILE_SIGNATURES.mp3_ff;
      if (mp3AltSignature && buffer.subarray(0, mp3AltSignature.length).equals(mp3AltSignature)) {
        return { valid: true, detectedType: "mp3" };
      }
    }
  }

  return { valid: false };
}

/**
 * Get file type category from extension
 */
function getFileTypeCategory(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const categories: Record<string, string> = {
    // Documents
    pdf: "documents",
    doc: "documents",
    docx: "documents",
    txt: "documents",
    // eBooks
    epub: "ebooks",
    mobi: "ebooks",
    azw: "ebooks",
    azw3: "ebooks",
    // Audio
    mp3: "audio",
    wav: "audio",
    flac: "audio",
    m4a: "audio",
    ogg: "audio",
    aac: "audio",
    // Video
    mp4: "video",
    mkv: "video",
    mov: "video",
    avi: "video",
    webm: "video",
    // Images
    jpg: "images",
    jpeg: "images",
    png: "images",
    gif: "images",
    webp: "images",
    svg: "images",
    // Archives
    zip: "archives",
    rar: "archives",
    "7z": "archives",
    tar: "archives",
    gz: "archives",
  };
  return categories[ext] || "other";
}

/**
 * Generate a unique file key for storage
 * Organized by: digital-rewards/{projectId}/{fileType}/{fileId}_{sanitizedName}
 */
export function generateFileKey(
  projectId: string,
  originalFilename: string,
  fileId?: string
): string {
  const id = fileId || crypto.randomUUID();
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);
  const fileType = getFileTypeCategory(originalFilename);
  return `digital-rewards/${projectId}/${fileType}/${id}_${sanitizedName}`;
}

/**
 * Generate a unique file key for marketplace uploads
 * Organized by: marketplace/{userId}/pdfs/{fileId}_{sanitizedName}
 */
export function generateMarketplaceFileKey(
  userId: string,
  originalFilename: string,
  fileId?: string
): string {
  const id = fileId || crypto.randomUUID();
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);
  return `marketplace/${userId}/pdfs/${id}_${sanitizedName}`;
}


/**
 * Generate a unique file key for email attachments
 * Organized by: email-attachments/{mailboxId}/{emailId}/{fileId}_{sanitizedName}
 */
export function generateEmailAttachmentKey(
  mailboxId: string,
  emailId: string,
  originalFilename: string,
  fileId?: string
): string {
  const id = fileId || crypto.randomUUID();
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 100);
  return `email-attachments/${mailboxId}/${emailId}/${id}_${sanitizedName}`;
}

