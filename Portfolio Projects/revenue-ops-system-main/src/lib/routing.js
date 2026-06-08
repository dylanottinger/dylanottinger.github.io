import db from './db.js';

export class RoutingException extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'RoutingException';
    this.reason = reason;
  }
}

/**
 * Deterministic Routing Engine
 */
export function routeLead(leadId, payload, enrichedData, score) {
  // 1. Validate data
  if (!enrichedData || !enrichedData.location) {
    throw new RoutingException('Missing required enrichment data', 'Enrichment Failed');
  }

  // 2. Determine Segment
  let segment = 'SMB';
  if (enrichedData.employees >= 1000) {
    segment = 'Enterprise';
  }

  // 3. Determine Territory
  const territory = enrichedData.location; // e.g. US or EMEA

  // 4. Query Available Reps
  const repsStmt = db.prepare(`
    SELECT id, capacity 
    FROM reps 
    WHERE territory = ? AND segment = ? AND active = 1
  `);
  
  const reps = repsStmt.all(territory, segment);

  // 5. Exception handling: No reps available
  if (reps.length === 0) {
    throw new RoutingException(`No active rep found for ${territory} - ${segment}`, 'No Available Rep');
  }

  // 6. Capacity-Aware Round Robin (simplified: pick rep with highest available capacity)
  // In a real system, you'd check how many open leads they have vs max capacity
  const assignedRep = reps.reduce((prev, current) => {
    return (prev.capacity > current.capacity) ? prev : current;
  });

  return assignedRep.id;
}
