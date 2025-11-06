import { NextRequest, NextResponse } from "next/server";

const MATHPIX_ENDPOINT = "https://api.mathpix.com/v3/pdf";
const APP_ID = process.env.MATHPIX_APP_ID;
const APP_KEY = process.env.MATHPIX_APP_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCredentialHeader() {
  const appId = APP_ID;
  const appKey = APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Mathpix credentials are missing. Set MATHPIX_APP_ID and MATHPIX_APP_KEY env vars.");
  }
  return { appId, appKey };
}

async function forwardToMathpix(arrayBuffer: ArrayBuffer) {
  const { appId, appKey } = getCredentialHeader();

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    Accept: "application/json",
    app_id: appId,
    app_key: appKey,
  };

  const response = await fetch(MATHPIX_ENDPOINT, {
    method: "POST",
    headers,
    body: arrayBuffer,
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return { response, parsed } as const;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing PDF file payload." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only application/pdf uploads are supported." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    const { response, parsed } = await forwardToMathpix(arrayBuffer);

    if (!response.ok) {
      return NextResponse.json(parsed ?? { error: "Mathpix rejected the request." }, {
        status: response.status,
      });
    }

    return NextResponse.json(parsed ?? { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { appId, appKey } = getCredentialHeader();

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId query parameter is required." }, { status: 400 });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      app_id: appId,
      app_key: appKey,
    };

    const response = await fetch(`${MATHPIX_ENDPOINT}/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      return NextResponse.json(
        parsed ?? { error: `Mathpix status lookup failed with ${response.status}.` },
        { status: response.status },
      );
    }

    return NextResponse.json(parsed ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
