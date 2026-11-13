// Shared helpers for the Netlify Functions in this folder.
// Files prefixed with "_" are ignored by Netlify as endpoints, so this
// module is safe to import from photos.mjs / logo.mjs / proposals.mjs.
import { getStore } from '@netlify/blobs';

export function store(name) {
  return getStore(name);
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function bytes(buf, contentType) {
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=300',
    },
  });
}

export function noContent(status) {
  return new Response(null, { status: status || 204 });
}

// Shared-password gate. Set the APP_PASSWORD environment variable in the
// Netlify site settings to require it; leave it unset to keep the app open.
// The browser sends it back as the "x-app-password" header once the person
// has typed it in (see public/index.html).
export function checkAuth(req) {
  const required = process.env.APP_PASSWORD;
  if (!required) return true;
  const given = req.headers.get('x-app-password') || '';
  return given === required;
}

export function unauthorized() {
  return json({ error: 'unauthorized' }, 401);
}

export function uid() {
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}

export async function readJsonBody(req) {
  try {
    return await req.json();
  } catch (e) {
    return null;
  }
}

export function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64');
}
