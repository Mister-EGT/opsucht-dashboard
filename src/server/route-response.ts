import { NextResponse } from "next/server";
import type { OpsuchtResult } from "@/server/opsucht-api";

const headers = {
  "Cache-Control": "private, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex",
};

export function opsuchtResponse<T>(result: OpsuchtResult<T>): NextResponse {
  if (result.ok) {
    return NextResponse.json(
      { data: result.data, meta: result.meta },
      { status: 200, headers },
    );
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

export function validationError(message: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "invalid_parameter",
        message,
        retryable: false,
      },
    },
    { status: 400, headers },
  );
}
