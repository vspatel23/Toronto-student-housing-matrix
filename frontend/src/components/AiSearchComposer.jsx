import { useEffect, useRef, useState } from "react";
import {
  AI_SEARCH_EXAMPLE,
  MAX_AI_SEARCH_DESCRIPTION_LENGTH,
  getAiSearchErrorPresentation,
  requestAiSearchFilters,
} from "../utils/aiSearch";
import StatusMessage from "./StatusMessage";

function AiSearchComposer({
  description = "",
  onDescriptionChange = () => {},
  onSearch,
  requestFilters = requestAiSearchFilters,
}) {
  const [validationMessage, setValidationMessage] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [aiError, setAiError] = useState(null);
  const requestInFlightRef = useRef(false);
  const textareaRef = useRef(null);
  const errorRegionRef = useRef(null);

  const isBlank = description.trim().length === 0;
  const errorPresentation = aiError
    ? getAiSearchErrorPresentation(aiError)
    : null;

  useEffect(() => {
    if (!aiError) {
      return;
    }

    const timeoutId = window.setTimeout(() => errorRegionRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [aiError]);

  const submitDescription = async () => {
    if (requestInFlightRef.current) {
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setValidationMessage("Enter a housing description before searching.");
      textareaRef.current?.focus();
      return;
    }

    if (description.length > MAX_AI_SEARCH_DESCRIPTION_LENGTH) {
      setValidationMessage(
        `Keep your description to ${MAX_AI_SEARCH_DESCRIPTION_LENGTH} characters or fewer.`,
      );
      textareaRef.current?.focus();
      return;
    }

    requestInFlightRef.current = true;
    setIsRequesting(true);
    setValidationMessage("");
    setAiError(null);

    try {
      const filters = await requestFilters(trimmedDescription);
      await onSearch?.({ filters, description });
    } catch (error) {
      setAiError(error);
    } finally {
      requestInFlightRef.current = false;
      setIsRequesting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    void submitDescription();
  };

  const handleDescriptionChange = (event) => {
    const nextDescription = event.target.value.slice(
      0,
      MAX_AI_SEARCH_DESCRIPTION_LENGTH,
    );
    onDescriptionChange(nextDescription);
    setAiError(null);

    if (nextDescription.trim()) {
      setValidationMessage("");
    } else if (nextDescription.length > 0) {
      setValidationMessage("Enter more than spaces before searching.");
    }
  };

  const handleDescriptionKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitDescription();
    }
  };

  return (
    <section className="ai-search-experience" aria-labelledby="ai-search-title">
      <div className="ai-search-intro">
        <p className="section-eyebrow">AI-powered housing search</p>
        <h1 id="ai-search-title">
          Describe what you&apos;re looking for
          <span>and we&apos;ll find the right places.</span>
        </h1>
        <p>Use natural language to tell us your preferences.</p>
      </div>

      <form className="ai-composer" onSubmit={handleSubmit} aria-busy={isRequesting}>
          <label className="ai-description-label" htmlFor="housing-description">
            Housing description
          </label>
          <textarea
            ref={textareaRef}
            id="housing-description"
            name="description"
            rows="4"
            maxLength={MAX_AI_SEARCH_DESCRIPTION_LENGTH}
            value={description}
            readOnly={isRequesting}
            aria-invalid={validationMessage ? "true" : "false"}
            aria-describedby={`ai-description-example ai-character-count${
              validationMessage ? " ai-description-validation" : ""
            }`}
            placeholder={`Example: ${AI_SEARCH_EXAMPLE}`}
            onChange={handleDescriptionChange}
            onKeyDown={handleDescriptionKeyDown}
            onBlur={() => {
              if (description.length > 0 && isBlank) {
                setValidationMessage("Enter more than spaces before searching.");
              }
            }}
          />

          <p id="ai-description-example" className="ai-description-help">
            Include details such as campus, monthly budget, commute, furnishing,
            or amenities. Press Ctrl/⌘ + Enter to search.
          </p>

          {(validationMessage || aiError || isRequesting) && (
            <div className="ai-composer-status">
              {validationMessage && (
                <StatusMessage id="ai-description-validation" type="validation">
                  {validationMessage}
                </StatusMessage>
              )}

              {isRequesting && (
                <StatusMessage type="loading">
                  Understanding your preferences…
                </StatusMessage>
              )}

              {aiError && (
                <div ref={errorRegionRef} tabIndex="-1">
                  <StatusMessage type="error">
                    <span>{errorPresentation.message}</span>
                    {errorPresentation.retryable && (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => void submitDescription()}
                      >
                        Retry
                      </button>
                    )}
                  </StatusMessage>
                </div>
              )}
            </div>
          )}

          <div className="ai-composer-footer">
            <span className="ai-powered-label" aria-hidden="true">
              <span>✦</span> AI-powered search
            </span>
            <div className="ai-composer-actions">
              <output id="ai-character-count" htmlFor="housing-description">
                {description.length} / {MAX_AI_SEARCH_DESCRIPTION_LENGTH}
              </output>
              <button
                type="submit"
                className="button button-primary ai-search-button"
                disabled={isBlank || isRequesting}
              >
                {isRequesting ? "Understanding…" : "Search"}
              </button>
            </div>
          </div>
      </form>
    </section>
  );
}

export default AiSearchComposer;
