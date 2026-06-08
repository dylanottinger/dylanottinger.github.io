import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { enrichLead, extractAITags } from '@/lib/enrichment';
import { scoreLead } from '@/lib/scoring';
import { routeLead, RoutingException } from '@/lib/routing';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function POST(req) {
  try {
    let payload;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object' || !payload.email) {
      return NextResponse.json({ error: 'Missing required field: email' }, { status: 400 });
    }

    const leadId = `lead_${generateId()}`;

    // 1. Initial Storage: Received
    db.prepare(`
      INSERT INTO leads (id, name, email, company, title, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      leadId, payload.name, payload.email, payload.company,
      payload.title, payload.source
    );

    const insertEvent = db.prepare(`INSERT INTO events (id, lead_id, event_type, details) VALUES (?, ?, ?, ?)`);
    insertEvent.run(`evt_${generateId()}`, leadId, 'Received', JSON.stringify(payload));

    // 2. Enrichment
    const enrichedData = await enrichLead(payload.email, payload.company);
    const aiTags = await extractAITags(payload, enrichedData);

    db.prepare(`UPDATE leads SET employees = ?, location = ? WHERE id = ?`)
      .run(enrichedData.employees, enrichedData.location, leadId);
    insertEvent.run(`evt_${generateId()}`, leadId, 'Enriched', JSON.stringify({ ...enrichedData, ...aiTags }));

    // 3. Scoring
    const score = scoreLead(payload, enrichedData);
    db.prepare(`UPDATE leads SET score = ? WHERE id = ?`).run(score, leadId);
    insertEvent.run(`evt_${generateId()}`, leadId, 'Scored', JSON.stringify({ score }));

    // 4. Routing
    try {
      const repId = routeLead(leadId, payload, enrichedData, score);

      db.prepare(`UPDATE leads SET rep_id = ?, status = 'Assigned' WHERE id = ?`).run(repId, leadId);
      insertEvent.run(`evt_${generateId()}`, leadId, 'Routed', JSON.stringify({ strategy: 'RulesEngine' }));
      insertEvent.run(`evt_${generateId()}`, leadId, 'Assigned', JSON.stringify({ rep_id: repId }));

      // Simulate SLA outcome synchronously so the event is guaranteed to be written
      const isMissed = Math.random() > 0.8;
      insertEvent.run(
        `evt_${generateId()}`, leadId,
        isMissed ? 'SLA Missed' : 'SLA Met',
        JSON.stringify({ time: '4m 30s' })
      );

    } catch (e) {
      if (e instanceof RoutingException) {
        db.prepare(`UPDATE leads SET status = 'Exception' WHERE id = ?`).run(leadId);
        insertEvent.run(`evt_${generateId()}`, leadId, 'Routing Failed', JSON.stringify({ reason: e.reason, message: e.message }));
        db.prepare(`
          INSERT INTO exceptions (id, lead_id, reason) VALUES (?, ?, ?)
        `).run(`exc_${generateId()}`, leadId, e.reason);
      } else {
        throw e;
      }
    }

    return NextResponse.json({ success: true, leadId });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
