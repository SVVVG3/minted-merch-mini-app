import { NextResponse } from 'next/server';

const ALCHEMY_URL = process.env.ALCHEMY_BASE_RPC_URL;

// Thin JSON-RPC proxy — keeps the Alchemy API key server-side while
// allowing the browser (spanDEX) to use a reliable RPC that supports
// eth_simulateV1 for quote simulation.
export async function POST(request) {
  if (!ALCHEMY_URL) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'RPC not configured' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('RPC proxy error:', err);
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' } },
      { status: 502 }
    );
  }
}
