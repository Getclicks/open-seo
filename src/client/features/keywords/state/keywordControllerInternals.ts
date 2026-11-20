import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { usePreferredKeywordLocation } from "@/client/features/keywords/hooks/usePreferredKeywordLocation";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { useActiveMarket } from "@/client/features/markets/activeMarket";
import { saveKeywords } from "@/serverFunctions/keywords";
import type { SaveKeywordsInput } from "@/types/schemas/keywords";
import type { KeywordResearchRow } from "@/types/keywords";

export function useResolvedKeywordLocation(input: {
  projectId: string;
  locationCode?: number;
}) {
  const projectMarket = useProjectMarket(input.projectId);
  const { active } = useActiveMarket(input.projectId);
  const {
    preferredLocationCode,
    selectedLocationCode,
    setPreferredLocationCode,
  } = usePreferredKeywordLocation(input.projectId, projectMarket?.locationCode);
  // A country picked in the form on this visit beats the top bar's market,
  // which beats the remembered preference.
  const [pickedLocationCode, setPickedLocationCode] = useState<number>();
  const marketLocationCode = pickedLocationCode ?? active?.locationCode;
  const locationCode =
    input.locationCode ?? marketLocationCode ?? selectedLocationCode;
  const displayedLocationCode =
    input.locationCode ?? marketLocationCode ?? preferredLocationCode;

  return {
    locationCode,
    displayedLocationCode,
    setPreferredLocationCode: (code: number) => {
      setPickedLocationCode(code);
      setPreferredLocationCode(code);
    },
  };
}

export function useKeywordUiState(initialShowFilters: boolean) {
  const [showFilters, setShowFilters] = useState(initialShowFilters);
  const [selectedKeyword, setSelectedKeyword] =
    useState<KeywordResearchRow | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [mobileTab, setMobileTab] = useState<"keywords" | "serp">("keywords");

  return {
    mobileTab,
    selectedKeyword,
    setMobileTab,
    setSelectedKeyword,
    setShowFilters,
    setShowSaveDialog,
    showFilters,
    showSaveDialog,
  };
}

export function useKeywordSearchParams() {
  const navigate = useNavigate({ from: "/p/$projectId/keywords" });

  return useCallback(
    (updates: Record<string, string | number | boolean | undefined>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );
}

export function useKeywordSaveMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveKeywordsInput) => saveKeywords({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
    },
  });
}
