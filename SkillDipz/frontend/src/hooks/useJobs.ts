"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getJobs, applyToJob } from "@/lib/jobsApi";
import { useJobsStore } from "@/store/jobsStore";
import type { JobListResponse, ApplyJobResponse } from "@/types/jobs";

interface UseJobsReturn {
  data: JobListResponse | null;
  isLoading: boolean;
  error: string | null;
  apply: (jobId: string) => Promise<ApplyJobResponse>;
  refresh: () => Promise<void>;
}

export function useJobs(): UseJobsReturn {
  const [data, setData] = useState<JobListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { filters } = useJobsStore();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getJobs(filters);
      if (isMounted.current) setData(result);
    } catch (err: any) {
      if (isMounted.current)
        setError(err?.response?.data?.detail || "Failed to load jobs");
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  const apply = useCallback(
    async (jobId: string): Promise<ApplyJobResponse> => {
      const response = await applyToJob(jobId);
      // Refresh the jobs list to update already_applied status
      await fetchData();
      return response;
    },
    [fetchData]
  );

  const refresh = useCallback(async (): Promise<void> => {
    await fetchData();
  }, [fetchData]);

  return { data, isLoading, error, apply, refresh };
}
