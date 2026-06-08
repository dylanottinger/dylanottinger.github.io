import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export async function POST(req) {
  try {
    const auth = verifyWebhookSecret(req, "GONG_WEBHOOK_SECRET");

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await req.json();

    if (!Number.isInteger(payload.contactId) || payload.contactId <= 0) {
      return badRequest("contactId must be a positive integer");
    }
    
    // Simulating deterministic logic to extract CRM updates from Gong transcript
    const suggestedMutation = await prisma.$transaction(async (tx) => {
      const mutation = await tx.suggestedMutation.create({
        data: {
          entityType: "Contact",
          entityId: payload.contactId,
          proposedChange: JSON.stringify({ title: "VP of Sales" }),
          confidenceScore: 82.5,
          reasoning: JSON.stringify([
            "Mentioned 'leading sales org'",
            "Mentioned managing 14 reps",
            "Email signature contained 'VP'",
          ]),
        },
      });

      await tx.event.create({
        data: {
          entityType: "Contact",
          entityId: payload.contactId,
          eventType: "EXTRACTION_SUGGESTED",
          payload: JSON.stringify({ source: "Gong", mutationId: mutation.id }),
        },
      });

      return mutation;
    });

    return NextResponse.json({
      success: true,
      message: "Gong transcript ingested and processed",
      suggestedMutation,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Request body must be valid JSON");
    }

    return serverError(error);
  }
}
