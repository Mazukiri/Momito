// Shared subset of the Momito API — mobile only needs Jobs + DSA
import Constants from "expo-constants";

const BASE: string = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:8000";
const TOKEN: string = (Constants.expoConfig?.extra?.apiToken as string) ?? "";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Jobs ---
export type JobStatus = "applied" | "oa" | "interview" | "offer" | "rejected" | "withdrawn";

export interface Job {
  id: number;
  company: string;
  role: string;
  url: string | null;
  status: JobStatus;
  applied_date: string | null;
  deadline: string | null;
  visa_tag: string | null;
  h1b_count_last_year: number | null;
  notes: string | null;
  created_at: string;
}

export const JOB_STATUSES: JobStatus[] = ["applied", "oa", "interview", "offer", "rejected", "withdrawn"];

export async function listJobs(): Promise<Job[]> {
  return req("GET", "/api/jobs/");
}

export async function createJob(data: { company: string; role: string; url?: string; status?: JobStatus }): Promise<Job> {
  return req("POST", "/api/jobs/", data);
}

export async function updateJob(id: number, data: Partial<{ status: JobStatus; notes: string }>): Promise<Job> {
  return req("PATCH", `/api/jobs/${id}`, data);
}

export async function deleteJob(id: number): Promise<void> {
  return req("DELETE", `/api/jobs/${id}`);
}

// --- DSA ---
export interface DSAProblem {
  id: number;
  leetcode_id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topics: string[];
  leetcode_url: string;
  solved: boolean;
  solved_date: string | null;
  created_at: string;
}

export interface DSAStats {
  total: number;
  solved: number;
  unsolved: number;
  by_difficulty: Record<string, { total: number; solved: number }>;
}

export async function addDSAProblem(leetcode_url: string): Promise<DSAProblem> {
  return req("POST", "/api/dsa/", { leetcode_url });
}

export async function listDSAProblems(): Promise<DSAProblem[]> {
  return req("GET", "/api/dsa/");
}

export async function markSolved(id: number, solved: boolean): Promise<DSAProblem> {
  return req("PATCH", `/api/dsa/${id}/solve`, { solved });
}

export async function getDSAStats(): Promise<DSAStats> {
  return req("GET", "/api/dsa/stats");
}
