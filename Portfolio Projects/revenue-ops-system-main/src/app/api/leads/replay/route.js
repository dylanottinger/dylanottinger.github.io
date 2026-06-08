import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { routeLead, RoutingException } from '@/lib/routing';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function POST(req) {
  try {
    const { leadId } = await req.json();
    
    // Fetch current lead data
    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const insertEvent = db.prepare(`INSERT INTO events (id, lead_id, event_type, details) VALUES (?, ?, ?, ?)`);
    insertEvent.run(`evt_${generateId()}`, leadId, 'Replayed', JSON.stringify({ reason: 'Operator Request' }));

    // Re-run routing
    try {
      // Re-create the mock enrichedData based on what we have
      const enrichedData = {
        employees: lead.employees,
        location: lead.location || 'US',
      };
      
      const repId = routeLead(leadId, lead, enrichedData, lead.score);
      
      // Update
      db.prepare(`UPDATE leads SET rep_id = ?, status = 'Assigned' WHERE id = ?`).run(repId, leadId);
      
      // Remove open exceptions
      db.prepare(`UPDATE exceptions SET status = 'Resolved' WHERE lead_id = ?`).run(leadId);

      insertEvent.run(`evt_${generateId()}`, leadId, 'Routed', JSON.stringify({ strategy: 'RulesEngine' }));
      insertEvent.run(`evt_${generateId()}`, leadId, 'Assigned', JSON.stringify({ rep_id: repId }));

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
    console.error('Replay Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
