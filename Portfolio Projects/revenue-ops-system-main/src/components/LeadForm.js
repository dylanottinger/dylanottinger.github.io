'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

export default function LeadForm({ onLeadSubmitted }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Jane Doe',
    email: 'jane@acme.com',
    company: 'Acme',
    title: 'VP Operations',
    source: 'demo_request'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/leads/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onLeadSubmitted();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2>Ingest Webhook Payload</h2>
        <div className="badge info">Test Utility</div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="flex gap-4">
          <div className="form-group flex-1">
            <label>Name</label>
            <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="form-group flex-1">
            <label>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="form-group flex-1">
            <label>Company</label>
            <input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
          </div>
          <div className="form-group flex-1">
            <label>Title</label>
            <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          </div>
        </div>

        <div className="form-group">
          <label>Source</label>
          <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
            <option value="demo_request">Demo Request</option>
            <option value="webinar">Webinar Signup</option>
            <option value="contact_sales">Contact Sales</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn flex items-center gap-2 mt-4">
          <Send size={14} />
          {loading ? 'Sending...' : 'Fire Webhook'}
        </button>
      </form>
    </div>
  );
}
