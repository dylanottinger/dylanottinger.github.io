function hashDomain(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

/**
 * Mock Data Enrichment Service (simulating Clearbit / Apollo)
 */
export async function enrichLead(email, companyDomain) {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));

  const domain = companyDomain || 'unknown.com';
  const seed = hashDomain(domain);

  // Demo trigger: any @apac.com email routes to APAC (no rep seeded → exception)
  if (email.endsWith('@apac.com')) {
    return {
      employees: 2400,
      industry: 'Technology',
      revenue: '$500M+',
      location: 'APAC',
      enriched_at: new Date().toISOString()
    };
  }

  const isEnterprise = domain.length < 8;
  const isTech = email.includes('tech') || email.includes('io');

  const employees = isEnterprise
    ? 1000 + (seed % 4000)
    : 10 + (seed % 90);

  return {
    employees,
    industry: isTech ? 'Technology' : 'Manufacturing',
    revenue: isEnterprise ? '$500M+' : '<$10M',
    location: seed % 2 === 0 ? 'US' : 'EMEA',
    enriched_at: new Date().toISOString()
  };
}

/**
 * Mock AI Layer (simulating OpenAI extraction)
 * Separated from routing logic per requirements.
 */
export async function extractAITags(payload, enrichedData) {
  await new Promise(resolve => setTimeout(resolve, 600));

  const text = `${payload.title} at ${payload.company} - ${payload.source}`;
  
  let urgency = 'Low';
  let intent = 'Browsing';

  if (text.toLowerCase().includes('demo') || text.toLowerCase().includes('pricing')) {
    urgency = 'High';
    intent = 'Buying';
  }

  if (payload.title && (payload.title.toLowerCase().includes('vp') || payload.title.toLowerCase().includes('director'))) {
    urgency = 'Medium';
  }

  return {
    ai_urgency: urgency,
    ai_intent: intent,
    ai_summary: `Prospect is a ${payload.title || 'user'} at a ${enrichedData.employees} person company.`
  };
}
