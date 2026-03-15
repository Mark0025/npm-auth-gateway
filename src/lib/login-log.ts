import "server-only";

export type LoginEntry = {
  timestamp: string;
  userId: string;
  ip: string;
};

/** Read all login entries from the JSONL log file on disk. */
export async function getLoginLog(): Promise<LoginEntry[]> {
  try {
    const fs = await import("fs/promises");
    const data = await fs.readFile("/data/login-logs/logins.jsonl", "utf-8");
    return data
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LoginEntry);
  } catch {
    return [];
  }
}

/** Append a login event (userId + IP + timestamp) to the JSONL log file. */
export async function appendLoginLog(userId: string, ip: string) {
  const fs = await import("fs/promises");
  const logDir = "/data/login-logs";
  try {
    await fs.mkdir(logDir, { recursive: true });
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      userId,
      ip,
    });
    await fs.appendFile(logDir + "/logins.jsonl", entry + "\n");
  } catch {
    // Log dir may not exist in dev — that's fine
  }
}
