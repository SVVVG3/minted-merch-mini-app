import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
