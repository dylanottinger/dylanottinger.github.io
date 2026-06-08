import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const leads = db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 20`).all();
    const reps = db.prepare(`SELECT * FROM reps`).all();
    const exceptions = db.prepare(`
      SELECT e.*, l.name, l.company, l.location
      FROM exceptions e
      JOIN leads l ON e.lead_id = l.id
      WHERE e.status = 'Open'
      ORDER BY e.created_at DESC
    `).all();
    
    // Batch-fetch all events for the returned leads in a single query
    const leadIds = leads.map(l => l.id);
    const placeholders = leadIds.map(() => '?').join(',');
    const allEvents = leadIds.length > 0
      ? db.prepare(`SELECT * FROM events WHERE lead_id IN (${placeholders}) ORDER BY created_at ASC`).all(...leadIds)
      : [];
    const eventsByLead = allEvents.reduce((acc, evt) => {
      (acc[evt.lead_id] ??= []).push(evt);
      return acc;
    }, {});
    const leadsWithEvents = leads.map(lead => ({ ...lead, events: eventsByLead[lead.id] ?? [] }));

    const stats = {
      totalLeads: db.prepare(`SELECT COUNT(*) as count FROM leads`).get().count,
      assigned: db.prepare(`SELECT COUNT(*) as count FROM leads WHERE status = 'Assigned'`).get().count,
      exceptions: db.prepare(`SELECT COUNT(*) as count FROM exceptions WHERE status = 'Open'`).get().count,
    };

    return NextResponse.json({ success: true, leads: leadsWithEvents, reps, exceptions, stats });
  } catch (error) {
    console.error('Data Fetch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
