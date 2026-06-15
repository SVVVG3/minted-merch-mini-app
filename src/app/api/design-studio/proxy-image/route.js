/**
 * GET /api/design-studio/proxy-image?url=https://...
 *
 * Server-side passthrough that fetches an external image (e.g. from R2) and
 * returns it with a same-origin response so the client can load it into a
 * canvas without CORS issues — used for in-browser image rotation.
 *
 * No auth required — the URL is already public (R2 public bucket).
 * Keep the endpoint simple; do not log the full URL to avoid leaking design data.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response('url param required', { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('proxy-image error:', err.message);
    return new Response('Proxy error', { status: 500 });
  }
}
