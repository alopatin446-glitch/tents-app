import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const requiredEnv = {
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET,
  publicUrl: process.env.S3_PUBLIC_URL,
};

function assertStorageEnv() {
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Не заполнены переменные окружения S3: ${missing.join(", ")}`
    );
  }
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension === fileName.toLowerCase()) {
    return "bin";
  }

  return extension;
}

function normalizePublicUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const s3 = new S3Client({
  region: requiredEnv.region || "ru-central1",
  endpoint: requiredEnv.endpoint,
  credentials: {
    accessKeyId: requiredEnv.accessKey || "",
    secretAccessKey: requiredEnv.secretKey || "",
  },
  forcePathStyle: true,
});

export async function uploadFileToS3(file: File, organizationId: string) {
  assertStorageEnv();

  if (!file || file.size === 0) {
    throw new Error("Файл для загрузки не передан.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = getFileExtension(file.name);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const key = `organizations/${organizationId}/orders/${year}/${month}/${randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: requiredEnv.bucket!,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return {
    key,
    url: `${normalizePublicUrl(requiredEnv.publicUrl!)}/${key}`,
  };
}