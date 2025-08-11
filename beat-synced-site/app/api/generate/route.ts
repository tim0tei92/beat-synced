import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { JOBS } from "@/lib/jobs";

export const runtime = "nodejs";

function writeTmp(file: File, destPath: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(destPath, buf);
      resolve(destPath);
    } catch (e) { reject(e); }
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const image = form.get("image") as File | null;
  const audio = form.get("audio") as File | null;
  const metaRaw = form.get("meta") as File | null;
  if (!image || !audio || !metaRaw) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const meta = JSON.parse(Buffer.from(await metaRaw.arrayBuffer()).toString("utf8"));
  const id = randomUUID();
  const workDir = `/tmp/${id}`;
  await fs.promises.mkdir(workDir, { recursive: true });
  const imagePath = path.join(workDir, image.name || "image.png");
  const audioPath = path.join(workDir, audio.name || "audio.wav");
  await writeTmp(image, imagePath);
  await writeTmp(audio, audioPath);

  const outPath = path.join(workDir, "final.mp4");
  const fps = Math.max(12, Math.min(60, parseInt(String(meta.frameRate || 24)) || 24));
  const duration = Math.max(1, Math.floor(meta.duration || 10));

  // Build a filter that does a slow Ken Burns zoom + brief flashes on beats
  // Zoom: scale up to ~1.15 over full duration
  const endZoom = 1.0 + Math.min(0.5, (meta.intensity || 60)/300); // 1.0..1.166
  const zoomExpr = `zoom='if(lte(on,0),1.0,${endZoom})':d=${fps*duration}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'`;
  // Flashes: for each beat, brighten for 0.08s
  const beats: number[] = Array.isArray(meta.beats) ? meta.beats : [];
  const flashSegments = beats.map((t:number) => `between(t,${(t).toFixed(2)},${(t+0.08).toFixed(2)})`).join("+");
  const flashExpr = flashSegments ? `eq=val+(${flashSegments})*0.4` : `eq=val`;

  // Create a short video from the single image (looped) at target FPS, then apply zoom & flashes
  // 1) -loop 1 keeps the image for the whole duration; 2) scale to a safe size (1920x1080 default) based on meta.resolution
  const size = meta.resolution === "4k" ? "3840:2160" : meta.resolution === "720p" ? "1280:720" : "1920:1080";

  // Progress management (fake ramp until done)
  JOBS.set(id, { id, status: "running", progress: 0 });
  const ticker = setInterval(() => {
    const j = JOBS.get(id);
    if (!j || j.status !== "running") return;
    j.progress = Math.min(0.95, (j.progress || 0) + 0.03);
    JOBS.set(id, j);
  }, 1000);

  const args = [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-i", audioPath,
    "-t", String(duration),
    "-r", String(fps),
    "-filter_complex",
    `[0:v]scale=${size},format=yuv420p,zoompan=${zoomExpr},eq=${flashExpr}[v];[1:a]anull[a]`,
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "320k",
    "-shortest",
    outPath
  ];

  const ffmpeg = spawn("ffmpeg", args);
  let stderr = "";
  ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
  ffmpeg.on("close", (code) => {
    clearInterval(ticker);
    if (code === 0 && fs.existsSync(outPath)) {
      JOBS.set(id, { id, status: "completed", progress: 1, url: `/api/download?p=${encodeURIComponent(outPath)}` });
    } else {
      JOBS.set(id, { id, status: "failed", progress: 1, error: stderr.slice(-400) || "ffmpeg error" });
    }
  });

  return NextResponse.json({ id });
}
