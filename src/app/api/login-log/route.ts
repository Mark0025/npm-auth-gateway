import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { requireUser } from "@/lib/auth-provider";

export async function GET() {
  await requireUser();

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
