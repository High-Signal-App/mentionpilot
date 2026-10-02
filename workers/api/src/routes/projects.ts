import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { getDb } from '../db';
import { requireSession } from '../middleware/auth';

const projects = new Hono<{ Bindings: Bindings; Variables: Variables }>();
projects.use('*', requireSession);

// POST / — create a project belonging to the authenticated owner.
projects.post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'A project name is required' }, 400);
  }
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return c.json({ error: 'Project name must contain 1–120 characters' }, 400);
  }

  const id = crypto.randomUUID();
  const project = await getDb(c.env.DB).createProject({
    id,
    user_id: c.get('userId')!,
    name: name.trim(),
    slug: `project-${id}`,
  });
  return c.json({ project }, 201);
});

// GET / — list user's projects, auto-create default if none exist
projects.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId')!;

  let list = await db.listProjectsByUser(userId);

  if (list.length === 0) {
    const id = crypto.randomUUID();
    const slug = `project-${id.slice(0, 8)}`;
    await db.createProject({ id, user_id: userId, name: 'My Project', slug });
    list = await db.listProjectsByUser(userId);
  }

  return c.json({ projects: list });
});

export { projects };
