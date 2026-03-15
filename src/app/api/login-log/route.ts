import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readFile("/data/login-logs/logins.jsonl", "utf-8");
    const entries = data
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    
    // Extract unique IPs
    const uniqueIPs = [...new Set(entries.map((e: { ip: string }) => e.ip))];
    
    return NextResponse.json({ 
      total_logins: entries.length,
      unique_ips: uniqueIPs,
      recent: entries.slice(-20).reverse(),
    });
  } catch {
    return NextResponse.json({ total_logins: 0, unique_ips: [], recent: [] });
  }
}
