/**
 * Deterministic Lead Scoring Engine
 * Evaluates points strictly based on enriched data attributes.
 */
export function scoreLead(payload, enrichedData) {
  let score = 0;

  // Title-based scoring
  const title = (payload.title || '').toLowerCase();
  if (title.includes('vp') || title.includes('director') || title.includes('chief') || ['ceo','cto','coo','cro','cmo'].some(t => title.includes(t))) {
    score += 20;
  }

  // Company size scoring
  const employees = enrichedData.employees || 0;
  if (employees > 1000) {
    score += 25;
  } else if (employees < 10) {
    score -= 10;
  }

  // Intent scoring
  const source = (payload.source || '').toLowerCase();
  if (source === 'demo_request' || source === 'contact_sales') {
    score += 30;
  }

  // Negative signal
  const email = (payload.email || '').toLowerCase();
  if (email.endsWith('.edu')) {
    score -= 50;
  }

  return Math.max(0, score);
}
