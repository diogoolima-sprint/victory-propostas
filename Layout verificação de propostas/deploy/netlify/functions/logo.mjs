// /.netlify/functions/logo
//
// GET    ?        -> { exists, contentType, updatedAt }
// GET    ?raw=1   -> raw image bytes
// POST   { contentType, dataBase64 } -> set the logo
// DELETE ?        -> remove the logo
import { store, json, bytes, noContent, checkAuth, unauthorized, readJsonBody, base64ToBuffer } from './_lib.mjs';

const META = () => store('victory-config');
const BLOB = () => store('victory-config');

export default async (req) => {
  if (!checkAuth(req)) return unauthorized();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const meta = await META().get('logo-meta', { type: 'json' });
    if (url.searchParams.get('raw')) {
      if (!meta) return json({ error: 'not_found' }, 404);
      const data = await BLOB().get('logo-blob', { type: 'arrayBuffer' });
      if (!data) return json({ error: 'not_found' }, 404);
      return bytes(data, meta.contentType || 'image/png');
    }
    return json(meta ? { exists: true, ...meta } : { exists: false });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || !body.dataBase64 || !body.contentType) return json({ error: 'bad_request' }, 400);
    const buf = base64ToBuffer(body.dataBase64);
    await BLOB().set('logo-blob', buf);
    await META().setJSON('logo-meta', { contentType: body.contentType, updatedAt: new Date().toISOString() });
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await BLOB().delete('logo-blob');
    await META().delete('logo-meta');
    return noContent();
  }

  return json({ error: 'method_not_allowed' }, 405);
};
