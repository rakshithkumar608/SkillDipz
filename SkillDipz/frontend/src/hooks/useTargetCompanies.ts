"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getTargetCompanies,
  selectTargetCompany,
  unselectTargetCompany,
} from "@/lib/targetCompanyApi";
import type { TargetCompaniesResponse, MatchedCompany } from "@/types/targetCompany";

interface UseTargetCompaniesReturn {
  data: TargetCompaniesResponse | null;
  isLoading: boolean;
  error: string | null;
  selectCompany: (company_id: string) => Promise<MatchedCompany>;
  removeCompany: (company_id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTargetCompanies(): UseTargetCompaniesReturn {
  const [data, setData] = useState<TargetCompaniesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const fetchData = useCallback(async (refresh?: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getTargetCompanies(refresh);
      if (isMounted.current) setData(result);
    } catch (err: any) {
      if (isMounted.current)
        setError(err?.response?.data?.detail || "Failed to load target companies");
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, [fetchData]);



  const selectCompany = useCallback(async (company_id: string): Promise<MatchedCompany> => {
    const response = await selectTargetCompany(company_id);
    await fetchData(true);
    return response.match_result;
  }, [fetchData]);

  const removeCompany = useCallback(async (company_id: string): Promise<void> => {
    await unselectTargetCompany(company_id);
    await fetchData(true);
  }, [fetchData]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    await fetchData(true);
  }, [fetchData]);

  return { data, isLoading, error, selectCompany, removeCompany, refresh: handleRefresh };
}