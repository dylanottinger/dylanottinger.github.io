import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const VALID_ACTIONS = new Set(["APPROVED", "REJECTED"]);

const CONTACT_FIELDS = new Set(["name", "email", "title", "company_size", "status"]);
const OPPORTUNITY_FIELDS = new Set([
  "name",
  "amount",
  "stage",
  "closeDate",
  "nextStep",
  "riskScore",
  "isStale",
  "lastActivityDate",
]);
const DATE_FIELDS = new Set(["closeDate", "lastActivityDate"]);

function parseMutationId(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseProposedChange(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeChange(entityType, proposedChange) {
  const allowedFields =
    entityType === "Contact"
      ? CONTACT_FIELDS
      : entityType === "Opportunity"
        ? OPPORTUNITY_FIELDS
        : null;

  if (!allowedFields) {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }

  return Object.fromEntries(
    Object.entries(proposedChange)
      .filter(([field]) => allowedFields.has(field))
      .map(([field, value]) => [
        field,
        DATE_FIELDS.has(field) && value != null ? new Date(value) : value,
      ])
      .filter(([, value]) => value != null && (!(value instanceof Date) || !Number.isNaN(value.getTime())))
  );
}

function formatMutation(mutation) {
  let reasoning;
  try {
    reasoning = JSON.parse(mutation.reasoning || "[]");
  } catch {
    reasoning = [];
  }
  if (!Array.isArray(reasoning)) {
    reasoning = [];
  }
  return {
    ...mutation,
    proposedChange: parseProposedChange(mutation.proposedChange) || {},
    reasoning,
  };
}

export async function GET() {
  try {
    const mutations = await prisma.suggestedMutation.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const contactIds = mutations.filter((m) => m.entityType === "Contact").map((m) => m.entityId);
    const opportunityIds = mutations.filter((m) => m.entityType === "Opportunity").map((m) => m.entityId);

    const [contacts, opportunities] = await Promise.all([
      contactIds.length > 0
        ? prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } })
        : [],
      opportunityIds.length > 0
        ? prisma.opportunity.findMany({ where: { id: { in: opportunityIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const nameMap = new Map([
      ...contacts.map((c) => [`Contact:${c.id}`, c.name]),
      ...opportunities.map((o) => [`Opportunity:${o.id}`, o.name]),
    ]);

    return NextResponse.json({
      success: true,
      mutations: mutations.map((m) => ({
        ...formatMutation(m),
        entityName: nameMap.get(`${m.entityType}:${m.entityId}`) ?? null,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req) {
  try {
    const { mutationId, action } = await req.json();
    const id = parseMutationId(mutationId);

    if (!id) {
      return badRequest("mutationId must be a positive integer");
    }

    if (!VALID_ACTIONS.has(action)) {
      return badRequest("action must be APPROVED or REJECTED");
    }

    const result = await prisma.$transaction(async (tx) => {
      const mutation = await tx.suggestedMutation.findUnique({
        where: { id },
      });

      if (!mutation) {
        return { status: 404, body: { error: "Mutation not found" } };
      }

      if (mutation.status !== "PENDING") {
        return { status: 409, body: { error: "Mutation has already been reviewed" } };
      }

      const proposedChange = parseProposedChange(mutation.proposedChange);

      if (!proposedChange) {
        return { status: 422, body: { error: "Mutation contains invalid proposedChange JSON" } };
      }

      if (action === "APPROVED") {
        const data = sanitizeChange(mutation.entityType, proposedChange);

        if (Object.keys(data).length === 0) {
          return { status: 422, body: { error: "Mutation does not contain allowed fields" } };
        }

        if (mutation.entityType === "Contact") {
          await tx.contact.update({ where: { id: mutation.entityId }, data });
        } else {
          await tx.opportunity.update({ where: { id: mutation.entityId }, data });
        }
      }

      const reviewedMutation = await tx.suggestedMutation.update({
        where: { id },
        data: { status: action },
      });

      await tx.event.create({
        data: {
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          eventType: action === "APPROVED" ? "MUTATION_APPROVED" : "MUTATION_REJECTED",
          payload: JSON.stringify({
            mutationId: id,
            action,
            proposedChange,
          }),
        },
      });

      return {
        status: 200,
        body: {
          success: true,
          message: `Mutation ${id} was ${action}`,
          mutation: formatMutation(reviewedMutation),
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Target CRM record not found" }, { status: 404 });
    }

    return serverError(error);
  }
}
