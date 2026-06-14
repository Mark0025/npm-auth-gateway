import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-provider";

const NPM_INTERNAL = (process.env.NPM_API_URL ?? "http://nginx-proxy-manager:81/api").replace(/\/api\/?$/, "");

async function proxyToNPM(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin/, "") || "/";
  const targetUrl = `${NPM_INTERNAL}${path}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!["host", "connection"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "content-encoding"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach NPM" }, { status: 502 });
  }
}

export const GET = proxyToNPM;
export const POST = proxyToNPM;
export const PUT = proxyToNPM;
export const DELETE = proxyToNPM;
export const PATCH = proxyToNPM;
