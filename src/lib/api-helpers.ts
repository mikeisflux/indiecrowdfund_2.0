import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

const apiHelpersLogger = logger.child({ module: "api-helpers" });

// Validated request-body parser. Replaces the common pattern of
//   const body = await req.json();
//   const { x, y, z } = body;
//   if (!x) return 400;
//   // ... use x, y, z as `any`
// with
//   const parsed = await parseBody(req, MySchema);
//   if ("response" in parsed) return parsed.response;
//   const { x, y, z } = parsed.data; // fully inferred
//
// This kills the FE↔BE contract-drift bug class structurally: a
// frontend that sends `projectID` instead of `projectId` produces a
// logged 400 with the bad path, instead of a silent undefined that
// reaches Prisma and surfaces as a generic 500 with no breadcrumb
// (the prelaunch reject pattern — fe4d6d3f). Validation issues are
// logged at warn level with both the issues array and the raw body,
// so when a contract DOES break in production it's a 30-second log
// grep instead of a multi-message debugging session.
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    }));
    apiHelpersLogger.warn({ issues, body: raw, url: req.url }, "Request body validation failed");
    return {
      response: NextResponse.json(
        { error: "Invalid request body", issues },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
}
