/**
 * Cloudflare R2 Storage Client
 *
 * Uses AWS SDK for S3-compatible API with Cloudflare R2
 * Provides presigned URLs for secure file uploads and downloads
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/lib/db";

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
   * Generate presigned URL for file upload
   */
  async getUploadUrl(
    key: string,
    options: UploadOptions = {}
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: options.expiresIn || 3600,
      });
    } catch (error) {
      console.error("R2 getUploadUrl error:", error);
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
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn || 3600,
    });
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
      console.error(`[R2] Failed to get file ${key}:`, error);
      return null;
    }
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
 * Parse marketplace file key to extract components
 */
function parseMarketplaceFileKey(key: string): {
  userId: string;
  fileId: string;
  filename: string;
} | null {
  const match = key.match(/^marketplace\/([^/]+)\/pdfs\/([^_]+)_(.+)$/);
  if (match) {
    return {
      userId: match[1],
      fileId: match[2],
      filename: match[3],
    };
  }
  return null;
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

/**
 * Parse file key to extract components
 */
function parseFileKey(key: string): {
  projectId: string;
  fileType: string;
  fileId: string;
  filename: string;
} | null {
  // New format: digital-rewards/{projectId}/{fileType}/{fileId}_{filename}
  const newMatch = key.match(/^digital-rewards\/([^/]+)\/([^/]+)\/([^_]+)_(.+)$/);
  if (newMatch) {
    return {
      projectId: newMatch[1],
      fileType: newMatch[2],
      fileId: newMatch[3],
      filename: newMatch[4],
    };
  }

  // Legacy format: digital-rewards/{projectId}/{fileId}_{filename}
  const legacyMatch = key.match(/^digital-rewards\/([^/]+)\/([^_]+)_(.+)$/);
  if (legacyMatch) {
    return {
      projectId: legacyMatch[1],
      fileType: "other",
      fileId: legacyMatch[2],
      filename: legacyMatch[3],
    };
  }

  return null;
}
