"use client";

import { useEffect, useState } from "react";

export default function MutationInbox({ onReviewed }) {
  const [mutations, setMutations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeReview, setActiveReview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMutations() {
      try {
        const response = await fetch("/api/mutations/review", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load mutations");
        }

        if (isMounted) {
          setMutations(data.mutations);
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

    loadMutations();

    return () => {
      isMounted = false;
    };
  }, []);

  async function reviewMutation(mutationId, action) {
    setActiveReview(`${mutationId}:${action}`);
    setError("");

    try {
      const response = await fetch("/api/mutations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutationId, action }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to review mutation");
      }

      setMutations((current) => current.filter((mutation) => mutation.id !== mutationId));
      onReviewed?.();
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setActiveReview(null);
    }
  }

  function getEntityLabel(mutation) {
    return mutation.entityName ?? `${mutation.entityType} #${mutation.entityId}`;
  }

  function getChangeLabel(proposedChange) {
    return Object.entries(proposedChange)
      .map(([field, value]) => `${field}: ${JSON.stringify(value)}`)
      .join(", ");
  }

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8 text-center text-gray-500 text-sm">
        Loading pending mutations...
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm divide-y">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
          {error}
        </div>
      )}
      {mutations.map((m) => (
        <div key={m.id} className="p-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="font-medium text-gray-900">{getEntityLabel(m)}</div>
            <div className="text-sm text-gray-800 font-semibold mt-1 bg-gray-50 p-2 rounded inline-block">
              {getChangeLabel(m.proposedChange)}
            </div>
            
            <div className="mt-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">AI Reasoning</div>
              <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc marker:text-gray-300">
                {m.reasoning.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="text-xs text-gray-400 mt-3 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full font-medium ${m.confidenceScore > 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {m.confidenceScore}% Confidence
              </span>
              <span>•</span>
              <span>{m.entityType} Mutation</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              className="px-3 py-1.5 text-sm bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 rounded shadow-sm w-full font-medium transition-colors"
              disabled={activeReview !== null}
              onClick={() => reviewMutation(m.id, "APPROVED")}
            >
              {activeReview === `${m.id}:APPROVED` ? "Approving" : "Approve"}
            </button>
            <button
              className="px-3 py-1.5 text-sm border text-gray-600 hover:bg-gray-50 disabled:text-gray-400 disabled:bg-gray-50 rounded w-full font-medium transition-colors"
              disabled={activeReview !== null}
              onClick={() => reviewMutation(m.id, "REJECTED")}
            >
              {activeReview === `${m.id}:REJECTED` ? "Rejecting" : "Reject"}
            </button>
          </div>
        </div>
      ))}
      {mutations.length === 0 && (
        <div className="p-8 text-center text-gray-500 text-sm">No pending mutations.</div>
      )}
    </div>
  );
}
