// /.netlify/functions/proposals
//
// GET    ?            -> list [{ id, cliente, numero, updatedAt }] (no stateJson, kept light)
// GET    ?id=<id>     -> full saved proposal { id, cliente, numero, stateJson, updatedAt }
// POST   { id?, cliente, numero, stateJson } -> create (no id) or update (with id), returns { id }
// DELETE ?id=<id>     -> remove one saved proposal
import { store, json, noContent, checkAuth, unauthorized, uid, readJsonBody } from './_lib.mjs';

const DB = () => store('victory-proposals');

export default async (req) => {
  if (!checkAuth(req)) return unauthorized();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const doc = await DB().get(id, { type: 'json' });
      if (!doc) return json({ error: 'not_found' }, 404);
      return json({ id, ...doc });
    }
    const { blobs } = await DB().list();
    const items = await Promise.all(
      blobs.map(async (b) => {
        const doc = await DB().get(b.key, { type: 'json' });
        if (!doc) return null;
        return { id: b.key, cliente: doc.cliente, numero: doc.numero, updatedAt: doc.updatedAt };
      }),
    );
    items.sort((a, b) => (a && b ? (a.updatedAt < b.updatedAt ? 1 : -1) : 0));
    return json({ proposals: items.filter(Boolean) });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || !body.stateJson) return json({ error: 'bad_request' }, 400);
    const id = body.id || uid();
    await DB().setJSON(id, {
      cliente: body.cliente || '(sem nome)',
      numero: body.numero || '',
      stateJson: body.stateJson,
      updatedAt: new Date().toISOString(),
    });
    return json({ id });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'bad_request' }, 400);
    await DB().delete(id);
    return noContent();
  }

  return json({ error: 'method_not_allowed' }, 405);
};
