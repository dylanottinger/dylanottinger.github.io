'use client';

import { useEffect, useState } from 'react';
import LeadForm from '@/components/LeadForm';
import LeadAuditLog from '@/components/LeadAuditLog';
import ExceptionsQueue from '@/components/ExceptionsQueue';

export default function Dashboard() {
  const [data, setData] = useState({ leads: [], stats: {}, exceptions: [] });
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchData = async () => {
    const res = await fetch('/api/data');
    if (res.ok) {
      const json = await res.json();
      setData(json);
      // Auto-update selected lead if new events arrived
      if (selectedLead) {
        const updated = json.leads.find(l => l.id === selectedLead.id);
        if (updated) setSelectedLead(updated);
      }
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReplay = async (leadId) => {
    await fetch('/api/leads/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId })
    });
    fetchData();
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>RevOps System</h2>
        <div className="mt-4">
          <div className="text-muted text-mono" style={{fontSize: '11px'}}>TOTAL LEADS</div>
          <div style={{fontSize: '24px', fontWeight: 'bold'}}>{data.stats.totalLeads || 0}</div>
        </div>
        <div className="mt-4">
          <div className="text-muted text-mono" style={{fontSize: '11px'}}>ASSIGNED</div>
          <div style={{fontSize: '24px', fontWeight: 'bold'}}>{data.stats.assigned || 0}</div>
        </div>
        <div className="mt-4">
          <div className="text-muted text-mono" style={{fontSize: '11px'}}>EXCEPTIONS</div>
          <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-danger)'}}>{data.stats.exceptions || 0}</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="flex gap-4 mb-4">
          <div style={{ flex: 2 }}>
            <ExceptionsQueue exceptions={data.exceptions} onReplay={handleReplay} onFixed={fetchData} />
            <LeadForm onLeadSubmitted={fetchData} />
            
            <div className="card mt-4">
              <h2>Recent Leads</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Score</th>
                    <th>Segment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{ cursor: 'pointer' }}>
                      <td className="text-mono">{lead.id}</td>
                      <td>{lead.name} ({lead.company})</td>
                      <td>{lead.score}</td>
                      <td>{lead.employees >= 1000 ? 'Enterprise' : 'SMB'}</td>
                      <td>
                        <span className={`badge ${lead.status === 'Assigned' ? 'success' : lead.status === 'Exception' ? 'danger' : 'warning'}`}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div style={{ flex: 1 }}>
            <LeadAuditLog lead={selectedLead} />
          </div>
        </div>
      </main>
    </div>
  );
}
