"use client";

import { useState } from "react";
import MutationInbox from "@/components/MutationInbox";
import PipelineRiskBoard from "@/components/PipelineRiskBoard";
import AuditLog from "@/components/AuditLog";

export default function Home() {
  const [reviewCount, setReviewCount] = useState(0);

  return (
    <div className="space-y-8">
      <header className="border-b pb-4">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">CRM Reliability Engine</h1>
        <p className="text-gray-500 mt-1">Operational workflows & pipeline governance.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-medium mb-4">Inbox: Proposed Mutations</h2>
            <MutationInbox onReviewed={() => setReviewCount((n) => n + 1)} />
          </section>

          <section>
            <h2 className="text-xl font-medium mb-4">Pipeline Risk Board</h2>
            <PipelineRiskBoard />
          </section>
        </div>

        <div className="lg:col-span-1 border-l pl-8">
          <h2 className="text-xl font-medium mb-4">Audit Log</h2>
          <AuditLog refreshKey={reviewCount} />
        </div>
      </div>
    </div>
  );
}
