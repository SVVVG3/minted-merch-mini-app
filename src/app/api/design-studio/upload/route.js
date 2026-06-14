import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { uploadBufferToR2 } from '@/lib/r2Storage';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PNG, JPEG, WebP, or GIF image.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const key = `user-designs/${auth.fid}-${Date.now()}.${ext}`;

    const publicUrl = await uploadBufferToR2(buffer, key, file.type);
    console.log(`📤 Design uploaded to R2 for FID ${auth.fid}: ${key}`);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Design upload error:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
