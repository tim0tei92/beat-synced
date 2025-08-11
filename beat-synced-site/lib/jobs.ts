type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number; // 0..1
  url?: string;
  error?: string;
};

// VERY simple in-memory job store (good for local/dev, not for multi-instance prod)
const g: any = global as any;
if (!g.__JOBS__) g.__JOBS__ = new Map<string, Job>();
export const JOBS: Map<string, Job> = g.__JOBS__ as Map<string, Job>;
