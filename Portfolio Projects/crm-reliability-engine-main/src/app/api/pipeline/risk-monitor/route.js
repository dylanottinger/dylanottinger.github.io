import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { RulesEngine } from "@/lib/rules-engine";

const SLA_BREACH_EVENT = "SLA_BREACH";

async function simulateLeadSlaEscalation() {
  const lead = {
    id: 1,
    name: "Sarah Jenkins",
    owner: "AE Team",
    lastTouchedAt: new Date(Date.now() - 7 * 60 * 1000),
    slaMinutes: 5,
  };
  const minutesUntouched = Math.floor((Date.now() - lead.lastTouchedAt.getTime()) / 60000);

  if (minutesUntouched <= lead.slaMinutes) {
    return null;
  }

  const existingBreach = await prisma.event.findFirst({
    where: {
      entityType: "Contact",
      entityId: lead.id,
      eventType: SLA_BREACH_EVENT,
      timestamp: { gte: lead.lastTouchedAt },
    },
    orderBy: { timestamp: "desc" },
  });

  if (existingBreach) {
    return {
      leadId: lead.id,
      leadName: lead.name,
      minutesUntouched,
      managerNotified: true,
      eventId: existingBreach.id,
    };
  }

  const event = await prisma.event.create({
    data: {
      entityType: "Contact",
      entityId: lead.id,
      eventType: SLA_BREACH_EVENT,
      payload: JSON.stringify({
        leadName: lead.name,
        owner: lead.owner,
        slaMinutes: lead.slaMinutes,
        minutesUntouched,
        action: "manager notified",
      }),
    },
  });

  return {
    leadId: lead.id,
    leadName: lead.name,
    minutesUntouched,
    managerNotified: true,
    eventId: event.id,
  };
}

export async function GET() {
  try {
    const policies = [
      {
        condition: { minAmount: 50000, inactivityDays: 10, pastCloseDate: true },
        action: { escalateRisk: 7.5, reasoningLabel: "Enterprise deal with no activity and past close date" },
      },
    ];

    const engine = new RulesEngine(policies);

    // Simulate fetching opportunities from CRM
    const opportunities = [
      {
        id: 101,
        name: "GlobalTech Q3 Expansion",
        amount: 120000,
        lastActivityDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        closeDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: 102,
        name: "Initech Initial Contract",
        amount: 45000,
        lastActivityDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        closeDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ];

    const evaluations = opportunities.map((opp) => ({
      opportunityId: opp.id,
      name: opp.name,
      amount: opp.amount,
      result: engine.evaluateOpportunity(opp),
    }));
    const slaEscalation = await simulateLeadSlaEscalation();

    return NextResponse.json({
      success: true,
      message: "Pipeline SLA check completed using Rules Engine",
      evaluations,
      slaEscalations: slaEscalation ? [slaEscalation] : [],
    });
  } catch (error) {
    return serverError(error);
  }
}
