import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Upload a Buffer to Cloudflare R2 and return the public URL.
 */
export async function uploadBufferToR2(buffer, key, contentType) {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
  return `${publicUrl}/${key}`;
}

/**
 * Delete an object from Cloudflare R2 by its key.
 * Silently succeeds if the object doesn't exist.
 */
export async function deleteFromR2(key) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }));
}

/**
 * Extract the R2 storage key from a public R2 URL.
 * e.g. https://pub-xxx.r2.dev/mockups/abc.png → mockups/abc.png
 */
export function r2KeyFromUrl(url) {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1);
  }
  // Fallback: take everything after the last domain segment
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

/**
 * Fetch an image from a URL and re-upload it to R2.
 * Used to permanently store Printful's expiring mockup URLs.
 */
export async function uploadUrlToR2(sourceUrl, key) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${sourceUrl}: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadBufferToR2(buffer, key, contentType);
}
