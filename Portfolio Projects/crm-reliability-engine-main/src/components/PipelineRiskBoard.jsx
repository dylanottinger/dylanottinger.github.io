"use client";

import { useEffect, useState } from "react";

export default function PipelineRiskBoard() {
  const [risks, setRisks] = useState([]);
  const [slaEscalations, setSlaEscalations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [escalated, setEscalated] = useState(new Set());

  useEffect(() => {
    let isMounted = true;

    async function loadRisks() {
      try {
        const response = await fetch("/api/pipeline/risk-monitor");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load pipeline risks");
        }

        if (isMounted) {
          setRisks(data.evaluations.filter((r) => r.result.isEscalated));
          setSlaEscalations(data.slaEscalations || []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRisks();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8 text-center text-gray-500 text-sm">
        Loading pipeline risks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 text-sm border rounded-lg">
        {error}
      </div>
    );
  }

  if (risks.length === 0 && slaEscalations.length === 0) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8 text-center text-gray-500 text-sm">
        No escalated opportunities.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {slaEscalations.map((sla) => (
        <div key={`sla-${sla.eventId}`} className="bg-white border rounded-lg p-4 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-medium text-gray-900">{sla.leadName}</h3>
              <p className="text-sm text-gray-500">Lead untouched for {sla.minutesUntouched} mins</p>
            </div>
            <div className="bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded text-sm">
              SLA
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-600">
            SLA Breach generated; manager notified.
          </div>
        </div>
      ))}
      {risks.map((r) => (
        <div key={r.opportunityId} className="bg-white border rounded-lg p-4 shadow-sm border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900">{r.name}</h3>
              <p className="text-sm text-gray-500">${r.amount.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-sm">
              {r.result.newRiskScore.toFixed(1)}
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {r.result.reasons.map((reason, i) => (
              <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {reason}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t">
            {escalated.has(r.opportunityId) ? (
              <span className="text-sm text-green-600 font-medium">Manager notified</span>
            ) : (
              <button
                className="text-sm text-blue-600 hover:underline font-medium"
                onClick={() => setEscalated((prev) => new Set(prev).add(r.opportunityId))}
              >
                Escalate to Manager
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
