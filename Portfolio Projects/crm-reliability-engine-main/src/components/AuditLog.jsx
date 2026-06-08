"use client";

import { useEffect, useState } from "react";

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export default function AuditLog({ refreshKey = 0 }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadEvents() {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load audit log");
        }

        if (isMounted) {
          setLogs(data.events);
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

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (isLoading) {
    return <div className="text-sm text-gray-400">Loading audit log...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {logs.length === 0 && (
        <div className="text-sm text-gray-400">No events yet.</div>
      )}
      {logs.map((log) => (
        <div key={log.id} className="text-sm">
          <div className="text-gray-400 text-xs mb-1">{timeAgo(log.timestamp)}</div>
          <div className="font-mono text-xs text-blue-600 bg-blue-50 inline-block px-1 mb-1 rounded">
            {log.eventType}
          </div>
          <div className="text-gray-700">{log.message}</div>
        </div>
      ))}
      <div className="pt-4 mt-4 border-t border-gray-100">
        <button className="text-sm text-gray-500 hover:text-gray-900">View all events →</button>
      </div>
    </div>
  );
}
