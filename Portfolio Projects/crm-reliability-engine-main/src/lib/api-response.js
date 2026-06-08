import { NextResponse } from "next/server";

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(error, message = "Internal server error") {
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}
