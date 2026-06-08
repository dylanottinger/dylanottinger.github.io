'use client';

import { useState } from 'react';
import { Play, AlertTriangle, UserCheck } from 'lucide-react';

export default function ExceptionsQueue({ exceptions, onReplay, onFixed }) {
  const [activating, setActivating] = useState(null);
  const [activated, setActivated] = useState(new Set());

  const handleActivateRep = async (repId, excId) => {
    setActivating(excId);
    await fetch('/api/reps/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repId }),
    });
    setActivated(prev => new Set(prev).add(excId));
    setActivating(null);
    if (onFixed) onFixed();
  };

  if (!exceptions || exceptions.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-muted">
          <AlertTriangle size={16} />
          <span>No exceptions in queue.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderColor: 'var(--text-danger)' }}>
      <h2 className="flex items-center gap-2" style={{ color: 'var(--text-danger)' }}>
        <AlertTriangle size={16} />
        Routing Exceptions Queue
      </h2>
      <table className="data-table mt-4">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Company</th>
            <th>Reason</th>
            <th>Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {exceptions.map(exc => {
            const isApac = exc.location === 'APAC';
            const isFixed = activated.has(exc.id);
            return (
              <tr key={exc.id}>
                <td>{exc.name}</td>
                <td>{exc.company}</td>
                <td><span className="badge danger">{exc.reason}</span></td>
                <td>{new Date(exc.created_at).toLocaleTimeString()}</td>
                <td>
                  <div className="flex gap-2">
                    {isApac && !isFixed && (
                      <button
                        className="btn btn-secondary flex items-center gap-2"
                        disabled={activating === exc.id}
                        onClick={() => handleActivateRep('rep_5', exc.id)}
                      >
                        <UserCheck size={12} />
                        {activating === exc.id ? 'Activating...' : 'Activate APAC Rep'}
                      </button>
                    )}
                    {isApac && isFixed && (
                      <span className="badge success">Rep Activated</span>
                    )}
                    <button
                      className="btn btn-secondary flex items-center gap-2"
                      onClick={() => onReplay(exc.lead_id)}
                    >
                      <Play size={12} />
                      Replay
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
