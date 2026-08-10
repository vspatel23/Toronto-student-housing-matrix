import { useEffect, useMemo, useRef, useState } from "react";
import { AUTH_TOKEN_KEY } from "../utils/constants";
import {
  formatAiComparisonText,
  getAiComparisonErrorPresentation,
  getAmenityInsights,
  requestAiComparisonRecommendation,
  validateAiComparisonRecommendation,
} from "../utils/aiComparison";
import { getListingId, getListingTitle } from "../utils/listingFormatters";
import StatusMessage from "./StatusMessage";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

const CATEGORY_CONFIG = [
  { key: "bestOverall", label: "Best overall", featured: true },
  { key: "bestBudget", label: "Best for budget" },
  { key: "bestCommute", label: "Best for commute" },
  { key: "bestSafety", label: "Best for safety" },
];

const EMPTY_AI_STATE = Object.freeze({
  selectionKey: "",
  recommendation: null,
  error: null,
  isLoading: false,
});

const normalizeListingId = (listingId) =>
  typeof listingId === "string" ? listingId.trim().toLowerCase() : "";

const createInvalidOutputError = () => {
  const error = new Error("AI comparison returned an invalid response.");
  error.code = "AI_OUTPUT_INVALID";
  return error;
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const createRecommendationView = (
  recommendation,
  selectedListingIds,
  titleById,
) => {
  if (!recommendation || typeof recommendation !== "object") {
    throw createInvalidOutputError();
  }

  const selectedIdSet = new Set(
    selectedListingIds.map((listingId) => normalizeListingId(listingId)),
  );

  const categories = Object.fromEntries(
    CATEGORY_CONFIG.map(({ key }) => {
      const result = recommendation[key];

      if (
        !result ||
        typeof result !== "object" ||
        !isNonEmptyString(result.reason)
      ) {
        throw createInvalidOutputError();
      }

      if (result.listingId === null) {
        return [
          key,
          {
            listingId: null,
            title: "Not determined from available data",
            reason: formatAiComparisonText(result.reason, titleById),
          },
        ];
      }

      const normalizedId = normalizeListingId(result.listingId);
      const title = titleById.get(normalizedId);

      if (!selectedIdSet.has(normalizedId) || !title) {
        throw createInvalidOutputError();
      }

      return [
        key,
        {
          listingId: normalizedId,
          title,
          reason: formatAiComparisonText(result.reason, titleById),
        },
      ];
    }),
  );

  if (!Array.isArray(recommendation.listingInsights)) {
    throw createInvalidOutputError();
  }

  const insightsById = new Map();

  recommendation.listingInsights.forEach((insight) => {
    const normalizedId = normalizeListingId(insight?.listingId);

    if (
      !selectedIdSet.has(normalizedId) ||
      insightsById.has(normalizedId) ||
      !isNonEmptyString(insight?.advantage) ||
      !isNonEmptyString(insight?.compromise)
    ) {
      throw createInvalidOutputError();
    }

    insightsById.set(normalizedId, insight);
  });

  const listingInsights = selectedListingIds.map((listingId) => {
    const normalizedId = normalizeListingId(listingId);
    const insight = insightsById.get(normalizedId);
    const title = titleById.get(normalizedId);

    if (!insight || !title) {
      throw createInvalidOutputError();
    }

    return {
      listingId: normalizedId,
      title,
      advantage: formatAiComparisonText(insight.advantage, titleById),
      compromise: formatAiComparisonText(insight.compromise, titleById),
    };
  });

  const amenityInsights = getAmenityInsights(recommendation).map((insight) => {
    const normalizedId = normalizeListingId(insight?.listingId);
    const title = titleById.get(normalizedId);

    if (
      !selectedIdSet.has(normalizedId) ||
      !title ||
      !isNonEmptyString(insight?.text)
    ) {
      throw createInvalidOutputError();
    }

    return {
      listingId: normalizedId,
      title,
      type: insight.type === "compromise" ? "Compromise" : "Advantage",
      text: formatAiComparisonText(insight.text, titleById),
    };
  });

  if (!isNonEmptyString(recommendation.recommendation)) {
    throw createInvalidOutputError();
  }

  return {
    categories,
    amenityInsights,
    listingInsights,
    recommendation: formatAiComparisonText(
      recommendation.recommendation,
      titleById,
    ),
  };
};

function AiComparisonSummary({
  listings = [],
  listingIds = [],
  requestRecommendation = requestAiComparisonRecommendation,
}) {
  const headingRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef(null);
  const [aiState, setAiState] = useState(EMPTY_AI_STATE);
  const selectedListingIds = useMemo(
    () =>
      Array.isArray(listingIds)
        ? listingIds
            .filter((listingId) => typeof listingId === "string")
            .map((listingId) => listingId.trim())
            .filter(Boolean)
        : [],
    [listingIds],
  );
  const selectionKey = selectedListingIds
    .map((listingId) => normalizeListingId(listingId))
    .join("|");
  const currentSelectionKeyRef = useRef(selectionKey);

  const titleById = useMemo(
    () =>
      new Map(
        listings
          .map((listing) => [
            normalizeListingId(getListingId(listing)),
            getListingTitle(listing),
          ])
          .filter(([listingId, title]) => listingId && isNonEmptyString(title)),
      ),
    [listings],
  );
  const normalizedSelectedIds = selectedListingIds.map((listingId) =>
    normalizeListingId(listingId),
  );
  const hasSupportedCount =
    selectedListingIds.length === 2 || selectedListingIds.length === 3;
  const hasValidIds =
    normalizedSelectedIds.length === selectedListingIds.length &&
    normalizedSelectedIds.every((listingId) =>
      OBJECT_ID_PATTERN.test(listingId),
    ) &&
    new Set(normalizedSelectedIds).size === normalizedSelectedIds.length;
  const hasResolvedListings =
    hasSupportedCount &&
    normalizedSelectedIds.every((listingId) => titleById.has(listingId));
  const isCurrentState =
    aiState.selectionKey === selectionKey && hasResolvedListings;
  const recommendation = isCurrentState ? aiState.recommendation : null;
  const error = isCurrentState ? aiState.error : null;
  const isLoading = isCurrentState ? aiState.isLoading : false;
  const canGenerate = hasSupportedCount && hasValidIds && hasResolvedListings;

  useEffect(() => {
    currentSelectionKeyRef.current = selectionKey;
    requestSequenceRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
  }, [selectionKey]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    },
    [],
  );

  const generateRecommendation = async () => {
    if (!canGenerate || isLoading) {
      return;
    }

    const requestListingIds = [...selectedListingIds];
    const requestSelectionKey = selectionKey;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setAiState((currentState) => ({
      selectionKey: requestSelectionKey,
      recommendation:
        currentState.selectionKey === requestSelectionKey
          ? currentState.recommendation
          : null,
      error: null,
      isLoading: true,
    }));

    try {
      const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
      const response = await requestRecommendation(requestListingIds, {
        authToken,
        signal: controller.signal,
      });
      const responseRecommendation =
        response?.success === true && response.recommendation
          ? response.recommendation
          : response;

      if (
        controller.signal.aborted ||
        requestId !== requestSequenceRef.current ||
        requestSelectionKey !== currentSelectionKeyRef.current
      ) {
        return;
      }

      const validatedRecommendation = validateAiComparisonRecommendation(
        responseRecommendation,
        requestListingIds,
      );
      const recommendationView = createRecommendationView(
        validatedRecommendation,
        requestListingIds,
        titleById,
      );

      if (
        controller.signal.aborted ||
        requestId !== requestSequenceRef.current ||
        requestSelectionKey !== currentSelectionKeyRef.current
      ) {
        return;
      }

      setAiState({
        selectionKey: requestSelectionKey,
        recommendation: recommendationView,
        error: null,
        isLoading: false,
      });
      window.requestAnimationFrame(() => headingRef.current?.focus());
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        requestId !== requestSequenceRef.current ||
        requestSelectionKey !== currentSelectionKeyRef.current
      ) {
        return;
      }

      const errorPresentation =
        getAiComparisonErrorPresentation(requestError);

      setAiState((currentState) => ({
        selectionKey: requestSelectionKey,
        recommendation:
          currentState.selectionKey === requestSelectionKey
            ? currentState.recommendation
            : null,
        error: errorPresentation,
        isLoading: false,
      }));
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  };

  let hint = "";
  if (selectedListingIds.length < 2) {
    hint = "Select at least 2 listings to generate an AI recommendation.";
  } else if (selectedListingIds.length > 3) {
    hint = "Select no more than 3 listings to generate an AI recommendation.";
  } else if (!hasValidIds || !hasResolvedListings) {
    hint = "Waiting for the selected listing details before generating.";
  }

  const actionHint =
    hint || "Generate optional AI guidance without changing the comparison above.";

  return (
    <section
      className="ai-comparison-section"
      aria-labelledby="ai-comparison-title"
      aria-busy={isLoading ? "true" : "false"}
    >
      <header className="ai-comparison__header">
        <div>
          <span className="ai-comparison__badge">AI guidance</span>
          <h2 id="ai-comparison-title" ref={headingRef} tabIndex={-1}>
            AI Comparison Summary
          </h2>
          <p id="ai-comparison-description">
            AI-generated guidance based only on your selected listings and
            available preferences.
          </p>
        </div>
      </header>

      <div className="ai-comparison__intro">
        <div>
          <p id="ai-comparison-hint" className="ai-comparison__hint">
            {actionHint}
          </p>
        </div>
        <div className="ai-comparison__actions">
          <button
            type="button"
            className="button button-primary"
            disabled={!canGenerate || isLoading}
            aria-describedby={
              "ai-comparison-description ai-comparison-hint"
            }
            onClick={generateRecommendation}
          >
            {recommendation ? "Regenerate" : "Generate AI Recommendation"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="ai-comparison__status">
          <StatusMessage type="loading">
            <span>Generating AI comparison...</span>
          </StatusMessage>
        </div>
      )}

      {error && (
        <div className="ai-comparison__status">
          <StatusMessage type="error">
            <span>{error.message}</span>
            {error.retryable && canGenerate && (
              <button
                type="button"
                className="secondary-button"
                disabled={isLoading}
                onClick={generateRecommendation}
              >
                Retry
              </button>
            )}
          </StatusMessage>
        </div>
      )}

      {recommendation && (
        <div
          className="ai-comparison__results"
          aria-label="AI-generated comparison guidance"
        >
          <div className="ai-comparison__categories">
            {CATEGORY_CONFIG.map(({ key, label, featured }) => {
              const category = recommendation.categories[key];

              return (
                <article
                  key={key}
                  className={`ai-comparison__category-card${
                    featured ? " featured" : ""
                  }`}
                >
                  <h3>{label}</h3>
                  <strong>{category.title}</strong>
                  <p>{category.reason}</p>
                </article>
              );
            })}

            <article className="ai-comparison__category-card">
              <h3>Amenity insight</h3>
              {recommendation.amenityInsights.length > 0 ? (
                <ul className="ai-comparison__amenity-list">
                  {recommendation.amenityInsights.map((insight, index) => (
                    <li
                      key={`${insight.listingId}-${insight.type}-${index}`}
                    >
                      <strong>{insight.title}</strong>
                      <span>{insight.type}</span>
                      <p>{insight.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No separate amenity insight was returned. Review the regular
                  amenities comparison above for listing details.
                </p>
              )}
            </article>
          </div>

          <section
            className="ai-comparison__insights"
            aria-labelledby="ai-listing-insights-title"
          >
            <h3 id="ai-listing-insights-title">Listing insights</h3>
            <div className="ai-comparison__insight-grid">
              {recommendation.listingInsights.map((insight) => (
                <article
                  key={insight.listingId}
                  className="ai-comparison__insight-card"
                >
                  <h4>{insight.title}</h4>
                  <dl>
                    <div>
                      <dt>Main advantage</dt>
                      <dd>{insight.advantage}</dd>
                    </div>
                    <div>
                      <dt>Main compromise</dt>
                      <dd>{insight.compromise}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section
            className="ai-comparison__recommendation"
            aria-labelledby="ai-final-recommendation-title"
          >
            <h3 id="ai-final-recommendation-title">Recommendation</h3>
            <p>{recommendation.recommendation}</p>
          </section>
        </div>
      )}
    </section>
  );
}

export default AiComparisonSummary;
