import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.searchParams.get("p");
  if (!p) return new Response("Missing p", { status: 400 });
  const resolved = path.resolve(p);
  if (!fs.existsSync(resolved)) return new Response("Not found", { status: 404 });
  const stat = fs.statSync(resolved);
  const stream = fs.createReadStream(resolved);
  return new Response(stream as any, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": "attachment; filename=beatsynced.mp4"
    }
  });
}
