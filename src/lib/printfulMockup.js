const BASE = 'https://api.printful.com';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function pfetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Printful ${options.method || 'GET'} ${path} → ${res.status}: ${err?.error?.message || res.statusText}`
    );
  }
  const data = await res.json();
  return data.result;
}

/**
 * Get all variants for a product (includes color, size, color_code).
 */
export function getProductVariants(productId) {
  return pfetch(`/products/${productId}`);
}

/**
 * Get print file specs for a product (dimensions, placements).
 */
export function getPrintfiles(productId, technique = null) {
  const query = technique ? `?technique=${technique}` : '';
  return pfetch(`/mockup-generator/printfiles/${productId}${query}`);
}

/**
 * Get layout templates for a product — used for the live client-side preview.
 * Returns template image URLs and print area coordinates.
 */
export function getLayoutTemplates(productId, technique = null) {
  const query = technique ? `?technique=${technique}` : '';
  return pfetch(`/mockup-generator/templates/${productId}${query}`);
}

/**
 * Create an async mockup generation task.
 * Returns { task_key, status }.
 */
export function createMockupTask(printfulProductId, payload) {
  return pfetch(`/mockup-generator/create-task/${printfulProductId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Poll for the result of a mockup generation task.
 * Returns { status, mockups } — status is 'pending' | 'completed' | 'failed'.
 */
export function getMockupTaskResult(taskKey) {
  return pfetch(`/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
}
