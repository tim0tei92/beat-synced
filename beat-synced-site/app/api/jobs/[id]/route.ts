import { JOBS } from "@/lib/jobs";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = JOBS.get(params.id);
  if (!job) return NextResponse.json({ status: "queued", progress: 0 });
  return NextResponse.json(job);
}
