import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@canopy-sight/config";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "canopy-sight";

const s3Client = new S3Client({
  region: "auto",
  endpoint: accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : process.env.R2_ENDPOINT || "http://localhost:9000",
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export interface UploadFileOptions {
  key: string;
  body: Buffer | ReadableStream | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export async function uploadFile(options: UploadFileOptions): Promise<{ key: string; etag?: string }> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: options.key,
    Body: options.body as string | Buffer | undefined,
    ContentType: options.contentType,
    Metadata: options.metadata,
  });

  const result = await s3Client.send(command);

  logger.info("File uploaded to R2", {
    key: options.key,
    contentType: options.contentType,
  });

  return { key: options.key, etag: result.ETag };
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await s3GetSignedUrl(s3Client, command, { expiresIn });
  return url;
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
  metadata?: Record<string, string>,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });

  const url = await s3GetSignedUrl(s3Client, command, { expiresIn });
  return url;
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
  logger.info("File deleted from R2", { key });
}

export interface ListFilesOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListFilesResult {
  files: Array<{
    key: string;
    size: number;
    lastModified: Date | undefined;
    etag: string | undefined;
  }>;
  nextToken?: string;
  isTruncated: boolean;
}

export async function listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: options.prefix,
    MaxKeys: options.maxKeys || 100,
    ContinuationToken: options.continuationToken,
  });

  const result = await s3Client.send(command);

  return {
    files: (result.Contents || []).map((item) => ({
      key: item.Key!,
      size: item.Size || 0,
      lastModified: item.LastModified,
      etag: item.ETag,
    })),
    nextToken: result.NextContinuationToken,
    isTruncated: result.IsTruncated || false,
  };
}

// Multipart upload for large drone imagery
export async function startMultipartUpload(
  key: string,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });

  const result = await s3Client.send(command);
  logger.info("Multipart upload started", { key, uploadId: result.UploadId });
  return result.UploadId!;
}

export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer,
): Promise<{ etag: string; partNumber: number }> {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body,
  });

  const result = await s3Client.send(command);
  return { etag: result.ETag!, partNumber };
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ etag: string; partNumber: number }>,
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({
        ETag: p.etag,
        PartNumber: p.partNumber,
      })),
    },
  });

  await s3Client.send(command);
  logger.info("Multipart upload completed", { key });
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
  logger.info("Multipart upload aborted", { key, uploadId });
}
