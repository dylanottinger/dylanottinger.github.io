import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export async function POST(req) {
  try {
    const auth = verifyWebhookSecret(req, "HUBSPOT_WEBHOOK_SECRET");

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await req.json();

    if (!Number.isInteger(payload.opportunityId) || payload.opportunityId <= 0) {
      return badRequest("opportunityId must be a positive integer");
    }
    
    // Simulating Hubspot Note ingestion
    const suggestedMutation = await prisma.$transaction(async (tx) => {
      const mutation = await tx.suggestedMutation.create({
        data: {
          entityType: "Opportunity",
          entityId: payload.opportunityId,
          proposedChange: JSON.stringify({ nextStep: "Security Review" }),
          confidenceScore: 95.0,
          reasoning: JSON.stringify([
            "Sales rep explicitly logged 'Next step is infosec review'",
            "Meeting titled 'Security Q&A'",
          ]),
        },
      });

      await tx.event.create({
        data: {
          entityType: "Opportunity",
          entityId: payload.opportunityId,
          eventType: "EXTRACTION_SUGGESTED",
          payload: JSON.stringify({ source: "HubSpot", mutationId: mutation.id }),
        },
      });

      return mutation;
    });

    return NextResponse.json({
      success: true,
      message: "HubSpot activity synced",
      suggestedMutation,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Request body must be valid JSON");
    }

    return serverError(error);
  }
}
