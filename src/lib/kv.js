// KV wrapper that works with Cloudflare KV REST API
const KV_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const KV_API_TOKEN = process.env.CLOUDFLARE_KV_API_TOKEN;

const KV_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${KV_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;

class CloudflareKV {
  async set(key, value, options = {}) {
    const response = await fetch(`${KV_API_BASE}/values/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${KV_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    });

    if (!response.ok) {
      throw new Error(`KV set failed: ${response.statusText}`);
    }

    // Handle expiration if provided
    if (options.ex) {
      await fetch(`${KV_API_BASE}/values/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${KV_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: JSON.stringify(value),
          expiration_ttl: options.ex
        })
      });
    }

    return 'OK';
  }

  async get(key) {
    const response = await fetch(`${KV_API_BASE}/values/${encodeURIComponent(key)}`, {
      headers: {
        'Authorization': `Bearer ${KV_API_TOKEN}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`KV get failed: ${response.statusText}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async del(key) {
    const response = await fetch(`${KV_API_BASE}/values/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${KV_API_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`KV delete failed: ${response.statusText}`);
    }

    return 1;
  }
}

export const kv = new CloudflareKV();