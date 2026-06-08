'use client';

export default function LeadAuditLog({ lead }) {
  if (!lead) return (
    <div className="card text-muted flex items-center justify-center" style={{ height: '300px' }}>
      Select a lead to view timeline
    </div>
  );

  return (
    <div className="card">
      <h2>Audit Log: {lead.id}</h2>
      <div className="text-muted mb-4 text-mono">
        {lead.name} ({lead.company}) • Score: {lead.score}
      </div>

      <div className="timeline mt-4">
        {lead.events && lead.events.map((evt, idx) => (
          <div className="timeline-item" key={evt.id}>
            <div className="timeline-time">{new Date(evt.created_at).toLocaleTimeString()}</div>
            <div className="timeline-content">
              <strong>{evt.event_type}</strong>
            </div>
            {evt.details && (
              <div className="timeline-details">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(JSON.parse(evt.details), null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
