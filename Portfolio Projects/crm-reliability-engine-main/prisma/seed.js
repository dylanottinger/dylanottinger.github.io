const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000);

async function main() {
  // Clear in dependency order (events and mutations reference contacts/opportunities by id,
  // but there are no FK constraints — order still prevents confusion on re-seed)
  await prisma.event.deleteMany();
  await prisma.suggestedMutation.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();

  // ─── Contacts ────────────────────────────────────────────────────────────────

  // Sarah's title was blank; an approved Gong extraction updated it 3 days ago.
  await prisma.contact.create({
    data: {
      id: 1,
      name: "Sarah Jenkins",
      email: "s.jenkins@globaltech.io",
      title: "VP of Sales",
      company_size: "250–500",
      status: "ACTIVE",
    },
  });

  // Marcus's title is stale — the pending mutation in the inbox will correct it.
  await prisma.contact.create({
    data: {
      id: 2,
      name: "Marcus Webb",
      email: "m.webb@acmecorp.com",
      title: "Senior Engineer",
      company_size: "500–1000",
      status: "ACTIVE",
    },
  });

  // Priya's email is outdated — a low-confidence HubSpot extraction is pending review.
  await prisma.contact.create({
    data: {
      id: 3,
      name: "Priya Nair",
      email: "p.nair@meridian-old.io",
      title: "Head of Procurement",
      company_size: "100–250",
      status: "ACTIVE",
    },
  });

  // Jordan had a duplicate contact merge proposed — it was rejected.
  await prisma.contact.create({
    data: {
      id: 4,
      name: "Jordan Cole",
      email: "j.cole@lighthouse.io",
      title: "Account Executive",
      company_size: "50–100",
      status: "ACTIVE",
    },
  });

  // David has no pending mutations — included to show a healthy contact state.
  await prisma.contact.create({
    data: {
      id: 5,
      name: "David Kim",
      email: "d.kim@initech.com",
      title: "Director of IT",
      company_size: "100–250",
      status: "ACTIVE",
    },
  });

  // ─── Opportunities ────────────────────────────────────────────────────────────

  // High-value deal: no activity in 15 days, close date passed 2 days ago.
  // Rules engine will escalate this (minAmount: 50k + inactivityDays: 10 + pastCloseDate).
  await prisma.opportunity.create({
    data: {
      id: 101,
      name: "GlobalTech Q3 Expansion",
      amount: 120000,
      stage: "Negotiation",
      closeDate: daysAgo(2),
      nextStep: "Final pricing approval",
      riskScore: 0.0,
      isStale: true,
      lastActivityDate: daysAgo(15),
    },
  });

  // Smaller deal: close date passed but amount is below the enterprise threshold.
  // Rules engine will not escalate — good contrast for the risk board.
  await prisma.opportunity.create({
    data: {
      id: 102,
      name: "Initech Initial Contract",
      amount: 45000,
      stage: "Proposal",
      closeDate: daysAgo(2),
      nextStep: "Awaiting legal signoff",
      riskScore: 0.0,
      isStale: false,
      lastActivityDate: daysAgo(3),
    },
  });

  // Active enterprise deal: a pending mutation will update the next step.
  await prisma.opportunity.create({
    data: {
      id: 103,
      name: "Acme Corp Security Review",
      amount: 95000,
      stage: "Evaluation",
      closeDate: daysAgo(-30), // 30 days from now
      nextStep: "Awaiting security questionnaire",
      riskScore: 0.0,
      isStale: false,
      lastActivityDate: hoursAgo(10),
    },
  });

  // Healthy mid-market deal — no mutations, no risk signals.
  await prisma.opportunity.create({
    data: {
      id: 104,
      name: "Meridian SaaS Migration",
      amount: 85000,
      stage: "Discovery",
      closeDate: daysAgo(-45),
      nextStep: "Technical scoping call scheduled",
      riskScore: 0.0,
      isStale: false,
      lastActivityDate: daysAgo(1),
    },
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────
  // Create in chronological order so inbox sorts correctly (newest first).

  // APPROVED 5 days ago: GlobalTech stage update came in from HubSpot.
  const globalTechStageMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Opportunity",
      entityId: 101,
      proposedChange: JSON.stringify({ stage: "Negotiation" }),
      confidenceScore: 79.0,
      reasoning: JSON.stringify([
        "Rep logged note: 'Moving to negotiation, sent redline'",
        "HubSpot deal stage pipeline event fired",
      ]),
      status: "APPROVED",
      createdAt: daysAgo(5),
    },
  });

  // APPROVED 3 days ago: Sarah Jenkins title extracted from a Gong call.
  const sarahTitleMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Contact",
      entityId: 1,
      proposedChange: JSON.stringify({ title: "VP of Sales" }),
      confidenceScore: 82.5,
      reasoning: JSON.stringify([
        "Mentioned 'I run the sales org' during intro",
        "Mentioned managing 14 direct reports",
        "Email signature parsed: 'VP of Sales, GlobalTech'",
      ]),
      status: "APPROVED",
      createdAt: daysAgo(4),
    },
  });

  // REJECTED 2 days ago: duplicate name merge for Jordan Cole — wrong match, rejected.
  const jordanMergeMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Contact",
      entityId: 4,
      proposedChange: JSON.stringify({ name: "Jordan Cole-Smith" }),
      confidenceScore: 55.0,
      reasoning: JSON.stringify([
        "Partial name match found in HubSpot import",
        "Company domain overlap between lighthouse.io and lighthouse-analytics.com",
      ]),
      status: "REJECTED",
      createdAt: daysAgo(2),
    },
  });

  // PENDING: Marcus Webb's title update — high confidence from Gong.
  const marcusTitleMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Contact",
      entityId: 2,
      proposedChange: JSON.stringify({ title: "Director of Engineering" }),
      confidenceScore: 91.2,
      reasoning: JSON.stringify([
        "Introduced himself as 'Director of Engineering' at call start",
        "LinkedIn title parsed from email footer: 'Dir. Engineering, Acme Corp'",
        "Previous title 'Senior Engineer' inconsistent with decision authority observed",
      ]),
      status: "PENDING",
      createdAt: daysAgo(1),
    },
  });

  // PENDING: Acme Corp next step update — strong signal from HubSpot activity note.
  const acmeNextStepMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Opportunity",
      entityId: 103,
      proposedChange: JSON.stringify({ nextStep: "Legal Review" }),
      confidenceScore: 88.0,
      reasoning: JSON.stringify([
        "Rep logged: 'Security questionnaire complete, handing to legal'",
        "Meeting titled 'Acme Corp — Legal Handoff' scheduled for next week",
      ]),
      status: "PENDING",
      createdAt: hoursAgo(8),
    },
  });

  // PENDING: Priya Nair email correction — lower confidence, needs human judgment.
  const priyaEmailMutation = await prisma.suggestedMutation.create({
    data: {
      entityType: "Contact",
      entityId: 3,
      proposedChange: JSON.stringify({ email: "p.nair@meridian.io" }),
      confidenceScore: 64.5,
      reasoning: JSON.stringify([
        "HubSpot note contains email: 'p.nair@meridian.io'",
        "New domain does not match existing record — manual verification recommended",
      ]),
      status: "PENDING",
      createdAt: hoursAgo(3),
    },
  });

  // ─── Events ───────────────────────────────────────────────────────────────────
  // Written in ascending chronological order; the API queries descending.

  await prisma.event.createMany({
    data: [
      // 5 days ago: GlobalTech stage extraction and same-day approval
      {
        entityType: "Opportunity",
        entityId: 101,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "HubSpot", mutationId: globalTechStageMutation.id }),
        timestamp: daysAgo(5),
      },
      {
        entityType: "Opportunity",
        entityId: 101,
        eventType: "MUTATION_APPROVED",
        payload: JSON.stringify({
          mutationId: globalTechStageMutation.id,
          action: "APPROVED",
          proposedChange: { stage: "Negotiation" },
        }),
        timestamp: new Date(daysAgo(5).getTime() + 30 * 60 * 1000), // 30 min later
      },

      // 4 days ago: Sarah Jenkins title extracted from Gong
      {
        entityType: "Contact",
        entityId: 1,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "Gong", mutationId: sarahTitleMutation.id }),
        timestamp: daysAgo(4),
      },

      // 3 days ago: Sarah Jenkins title approved
      {
        entityType: "Contact",
        entityId: 1,
        eventType: "MUTATION_APPROVED",
        payload: JSON.stringify({
          mutationId: sarahTitleMutation.id,
          action: "APPROVED",
          proposedChange: { title: "VP of Sales" },
        }),
        timestamp: daysAgo(3),
      },

      // 2 days ago: Jordan Cole merge suggested then rejected
      {
        entityType: "Contact",
        entityId: 4,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "HubSpot", mutationId: jordanMergeMutation.id }),
        timestamp: daysAgo(2),
      },
      {
        entityType: "Contact",
        entityId: 4,
        eventType: "MUTATION_REJECTED",
        payload: JSON.stringify({
          mutationId: jordanMergeMutation.id,
          action: "REJECTED",
          proposedChange: { name: "Jordan Cole-Smith" },
        }),
        timestamp: new Date(daysAgo(2).getTime() + 45 * 60 * 1000), // 45 min later
      },

      // 1 day ago: Marcus Webb title extracted from Gong
      {
        entityType: "Contact",
        entityId: 2,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "Gong", mutationId: marcusTitleMutation.id }),
        timestamp: daysAgo(1),
      },

      // 8 hours ago: Acme Corp next step extracted from HubSpot
      {
        entityType: "Opportunity",
        entityId: 103,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "HubSpot", mutationId: acmeNextStepMutation.id }),
        timestamp: hoursAgo(8),
      },

      // 3 hours ago: Priya Nair email extracted from HubSpot
      {
        entityType: "Contact",
        entityId: 3,
        eventType: "EXTRACTION_SUGGESTED",
        payload: JSON.stringify({ source: "HubSpot", mutationId: priyaEmailMutation.id }),
        timestamp: hoursAgo(3),
      },
    ],
  });

  console.log("Seed complete.");
  console.log("  Contacts:   5");
  console.log("  Opportunities: 4");
  console.log("  Mutations:  6 (3 PENDING, 2 APPROVED, 1 REJECTED)");
  console.log("  Events:     9");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
