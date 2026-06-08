import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

function formatEventMessage(event) {
  try {
    const payload = JSON.parse(event.payload);
    switch (event.eventType) {
      case "MUTATION_APPROVED":
        return `${event.entityType} #${event.entityId} updated via approved mutation`;
      case "MUTATION_REJECTED":
        return `Mutation rejected for ${event.entityType} #${event.entityId}`;
      case "EXTRACTION_SUGGESTED":
        return `Extracted suggestion from ${payload.source || "unknown source"} for ${event.entityType} #${event.entityId}`;
      case "SLA_BREACH":
        return `SLA breach: ${payload.leadName || `${event.entityType} #${event.entityId}`} untouched for ${payload.minutesUntouched} mins; manager notified`;
      default:
        return `${event.eventType} on ${event.entityType} #${event.entityId}`;
    }
  } catch {
    return `${event.eventType} on ${event.entityType} #${event.entityId}`;
  }
}

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        message: formatEventMessage(event),
        timestamp: event.timestamp,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
