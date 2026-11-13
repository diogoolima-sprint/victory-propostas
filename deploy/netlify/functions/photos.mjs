// /.netlify/functions/photos
//
// GET    ?             -> list of photo metadata (no image bytes)
// GET    ?raw=<id>     -> raw image bytes for <img src="...">
// POST   { category, name, contentType, dataBase64 } -> create, returns { id }
// DELETE ?id=<id>      -> remove one photo
import { store, json, bytes, noContent, checkAuth, unauthorized, uid, readJsonBody, base64ToBuffer } from './_lib.mjs';

const META = () => store('victory-photos-meta');
const BLOB = () => store('victory-photos-blob');

export default async (req) => {
  if (!checkAuth(req)) return unauthorized();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const rawId = url.searchParams.get('raw');
    if (rawId) {
      const meta = await META().get(rawId, { type: 'json' });
      if (!meta) return json({ error: 'not_found' }, 404);
      const data = await BLOB().get(rawId, { type: 'arrayBuffer' });
      if (!data) return json({ error: 'not_found' }, 404);
      return bytes(data, meta.contentType || 'image/jpeg');
    }
    const { blobs } = await META().list();
    const items = await Promise.all(
      blobs.map(async (b) => {
        const meta = await META().get(b.key, { type: 'json' });
        return meta ? { id: b.key, ...meta } : null;
      }),
    );
    return json({ photos: items.filter(Boolean).sort((a, b) => (a.category > b.category ? 1 : -1)) });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || !body.dataBase64 || !body.contentType) return json({ error: 'bad_request' }, 400);
    const id = uid();
    const buf = base64ToBuffer(body.dataBase64);
    await BLOB().set(id, buf);
    await META().setJSON(id, {
      category: body.category || 'fachada',
      name: body.name || 'foto',
      contentType: body.contentType,
      sizeBytes: buf.length,
      createdAt: new Date().toISOString(),
    });
    return json({ id });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'bad_request' }, 400);
    await META().delete(id);
    await BLOB().delete(id);
    return noContent();
  }

  return json({ error: 'method_not_allowed' }, 405);
};
