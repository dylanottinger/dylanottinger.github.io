import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export async function POST(req) {
  try {
    const auth = verifyWebhookSecret(req, "TRANSCRIPT_API_KEY");

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { transcript, entityId, entityType } = await req.json();

    if (typeof transcript !== "string" || transcript.trim().length === 0) {
      return badRequest("transcript is required");
    }

    if (!Number.isInteger(entityId) || entityId <= 0) {
      return badRequest("entityId must be a positive integer");
    }

    if (!["Contact", "Opportunity"].includes(entityType)) {
      return badRequest("entityType must be Contact or Opportunity");
    }
    
    // Simulate deterministic / AI extraction
    const extractedFields = { title: "VP of Sales", confidence: 85 };
    
    // Simulate DB logic
    // const mutation = await prisma.suggestedMutation.create({ ... })
    // const event = await prisma.event.create({ ... })

    return NextResponse.json({
      success: true,
      message: "Transcript processed",
      suggestedMutation: extractedFields,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Request body must be valid JSON");
    }

    return serverError(error);
  }
}
