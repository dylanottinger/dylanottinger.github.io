import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req) {
  try {
    const { repId } = await req.json();
    const rep = db.prepare(`SELECT * FROM reps WHERE id = ?`).get(repId);
    if (!rep) return NextResponse.json({ error: 'Rep not found' }, { status: 404 });

    db.prepare(`UPDATE reps SET active = 1 WHERE id = ?`).run(repId);
    return NextResponse.json({ success: true, repId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
