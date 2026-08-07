import { apiRequest } from "./api";

export const MAX_AI_SEARCH_DESCRIPTION_LENGTH = 1500;

export const AI_SEARCH_EXAMPLE =
  "I want a furnished apartment near Toronto Metropolitan University, between $1200 and $1800, within 30 minutes commute, with WiFi and laundry.";

const retryableAiErrorCodes = new Set([
  "AI_SERVICE_TIMEOUT",
  "AI_SERVICE_UNAVAILABLE",
  "AI_OUTPUT_INVALID",
]);

const aiErrorMessages = {
  INVALID_DESCRIPTION: "Please enter a clear housing description and try again.",
  DESCRIPTION_TOO_LONG: `Keep your description to ${MAX_AI_SEARCH_DESCRIPTION_LENGTH} characters or fewer.`,
  AI_NOT_CONFIGURED:
    "AI search is not available right now. You can still use Advanced Search.",
  AI_CONFIGURATION_INVALID:
    "AI search is not available right now. You can still use Advanced Search.",
  AI_SERVICE_UNAVAILABLE:
    "We couldn't process your search right now. Your description has been kept.",
  AI_SERVICE_TIMEOUT:
    "We couldn't process your search right now. Your description has been kept.",
  AI_OUTPUT_INVALID:
    "We couldn't interpret the search response. Your description has been kept.",
};

export const getAiSearchErrorPresentation = (error) => ({
  message:
    aiErrorMessages[error?.code] ||
    "We couldn't process your search right now. Your description has been kept.",
  retryable: !error?.code || retryableAiErrorCodes.has(error.code),
});

export const requestAiSearchFilters = async (description) => {
  const data = await apiRequest("/api/ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description }),
  });

  if (
    !data?.success ||
    !data.filters ||
    typeof data.filters !== "object" ||
    Array.isArray(data.filters)
  ) {
    const error = new Error("AI search returned an invalid response.");
    error.code = "AI_OUTPUT_INVALID";
    throw error;
  }

  return data.filters;
};
