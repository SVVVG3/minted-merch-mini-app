import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { uploadBufferToR2 } from '@/lib/r2Storage';

/**
 * Parse EXIF orientation from a raw JPEG Buffer (Node.js).
 * Returns 1 (normal) for non-JPEG or when orientation tag is not found.
 * Common values:
 *   1 = normal, 3 = 180°, 6 = 90° CW (camera rotated CCW), 8 = 270° CW
 */
function parseExifOrientation(buf) {
  try {
    if (buf.length < 20 || buf.readUInt16BE(0) !== 0xffd8) return 1; // not JPEG
    let offset = 2;
    while (offset + 4 < buf.length) {
      const marker = buf.readUInt16BE(offset);
      const segLen  = buf.readUInt16BE(offset + 2); // includes length field, not marker
      if (marker === 0xffe1 && segLen >= 16) {       // APP1
        // Check "Exif" magic at offset+4
        if (buf.readUInt32BE(offset + 4) !== 0x45786966) { offset += 2 + segLen; continue; }
        // TIFF header starts at offset+10 (after marker 2b + length 2b + "Exif" 4b + "\0\0" 2b)
        const tiff   = offset + 10;
        const little = buf.readUInt16BE(tiff) === 0x4949;
        const readU16 = little ? buf.readUInt16LE.bind(buf) : buf.readUInt16BE.bind(buf);
        const readU32 = little ? buf.readUInt32LE.bind(buf) : buf.readUInt32BE.bind(buf);
        const ifd0   = tiff + readU32(tiff + 4);
        const entries = readU16(ifd0);
        for (let i = 0; i < entries && i < 64; i++) {
          const tagOff = ifd0 + 2 + 12 * i;
          if (tagOff + 10 > buf.length) break;
          if (readU16(tagOff) === 0x0112) return readU16(tagOff + 8); // Orientation tag
        }
        return 1;
      }
      if (marker === 0xffda) break; // SOS — stop searching
      offset += 2 + segLen;
    }
  } catch { /* ignore parse errors */ }
  return 1;
}

/**
 * Re-upload an external image URL to R2 so Printful can always fetch it.
 * Also parses EXIF orientation and returns it so the client can bake in the
 * rotation before sending to Printful (browsers auto-correct EXIF in <img>
 * tags but Printful renders raw pixels, causing sideways mockups).
 */
export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    new URL(url); // validate

    // Fetch raw bytes first so we can inspect EXIF before uploading
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(`Failed to fetch image: ${upstream.status}`);
    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    const exifOrientation = parseExifOrientation(buf);
    if (exifOrientation !== 1) {
      console.log(`📐 fetch-url: EXIF orientation ${exifOrientation} detected for FID ${auth.fid}`);
    }

    // Detect animated or static GIFs — Printful can't process them; client will flatten via canvas
    const isGif = contentType.includes('image/gif') ||
      (buf.length >= 6 && buf.slice(0, 6).toString('ascii').startsWith('GIF'));
    if (isGif) {
      console.log(`🎞️ fetch-url: GIF detected for FID ${auth.fid} — client will flatten to static image`);
    }

    // Upload the raw bytes (EXIF still present; client will apply rotation / GIF flatten if needed)
    const ext = isGif ? 'gif' : 'jpg';
    const r2Key = `user-designs/${auth.fid}-cast-${Date.now()}.${ext}`;
    const r2Url = await uploadBufferToR2(buf, r2Key, contentType);

    console.log(`📥 Cast image uploaded to R2 for FID ${auth.fid}: ${r2Key}`);
    return NextResponse.json({ success: true, url: r2Url, exifOrientation, isGif });
  } catch (error) {
    console.error('Fetch-URL error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
