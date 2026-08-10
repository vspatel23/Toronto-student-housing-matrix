import { useId, useState } from "react";

import {
  HOUSING_COST_FIELDS,
  calculateMonthlyHousingCost,
  createDefaultHousingCosts,
  formatCanadianCurrency,
  formatHousingCostDifference,
  normalizeListingRent,
  setHousingCostEnabled,
  updateHousingCostAmount,
} from "../utils/monthlyHousingCost";

const UNAVAILABLE_TOTAL = "Unavailable";

const getCalculatorKey = (listingId, listingRent) => {
  const normalizedRent = normalizeListingRent(listingRent);
  const rentKey = normalizedRent === null ? String(listingRent) : normalizedRent;

  return `${listingId || "listing"}:${rentKey}`;
};

function MonthlyHousingCostCalculatorForm({ listingRent }) {
  const generatedId = useId().replaceAll(":", "");
  const amountHelpId = `${generatedId}-amount-help`;
  const [housingCosts, setHousingCosts] = useState(() =>
    createDefaultHousingCosts(listingRent),
  );
  const calculation = calculateMonthlyHousingCost(housingCosts);
  const defaultCosts = createDefaultHousingCosts(listingRent);
  const hasValidRent = housingCosts.advertisedRent !== null;

  const handleAmountChange = (fieldKey, amount) => {
    setHousingCosts((currentCosts) =>
      updateHousingCostAmount(currentCosts, fieldKey, amount),
    );
  };

  const handleEnabledChange = (fieldKey, enabled) => {
    setHousingCosts((currentCosts) =>
      setHousingCostEnabled(currentCosts, fieldKey, enabled),
    );
  };

  const handleReset = () => {
    setHousingCosts(createDefaultHousingCosts(listingRent));
  };

  return (
    <section
      className="detail-section monthly-cost-calculator"
      aria-labelledby={`${generatedId}-title`}
    >
      <div className="monthly-cost-header">
        <div>
          <p className="section-eyebrow">Planning tool</p>
          <h2 id={`${generatedId}-title`}>Monthly Housing Cost Estimate</h2>
        </div>
        <p className="monthly-cost-disclaimer">
          Advertised rent comes from this listing. Other amounts are editable
          planning estimates and may vary based on usage, providers, and
          personal choices.
        </p>
      </div>

      <dl className="monthly-cost-rent" aria-label="Advertised listing rent">
        <div className="monthly-cost-rent-value">
          <dt>Advertised Monthly Rent</dt>
          <dd>
            {hasValidRent
              ? formatCanadianCurrency(housingCosts.advertisedRent)
              : UNAVAILABLE_TOTAL}
          </dd>
        </div>
        <div className="monthly-cost-rent-source">
          <dt className="visually-hidden">Source</dt>
          <dd>Listing data (read-only)</dd>
        </div>
      </dl>

      {!hasValidRent && (
        <p className="monthly-cost-rent-fallback" role="status">
          Monthly cost estimate unavailable because this listing does not have
          a valid advertised rent.
        </p>
      )}

      <fieldset className="monthly-cost-fields">
        <legend className="visually-hidden">
          Editable monthly expense estimates
        </legend>
        <p className="visually-hidden" id={amountHelpId}>
          Enter monthly amounts in Canadian dollars.
        </p>
        {HOUSING_COST_FIELDS.map((field) => {
          const inputId = `${generatedId}-${field.key}`;
          const errorId = `${inputId}-error`;
          const enabled = housingCosts.enabled[field.key];
          const errorMessage = calculation.fieldErrors[field.key] || "";

          return (
            <div
              className={`monthly-cost-field${enabled ? "" : " is-disabled"}`}
              key={field.key}
            >
              <div className="monthly-cost-field-heading">
                <label htmlFor={inputId}>{field.label}</label>
                {field.optional && (
                  <label className="monthly-cost-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      aria-label={`Include ${field.label}`}
                      onChange={(event) =>
                        handleEnabledChange(field.key, event.target.checked)
                      }
                    />
                    <span>{enabled ? "Included" : "Not included"}</span>
                  </label>
                )}
              </div>

              <div className="monthly-cost-input-wrap">
                <span aria-hidden="true">$</span>
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  autoComplete="off"
                  spellCheck="false"
                  value={housingCosts.expenses[field.key]}
                  disabled={!enabled}
                  aria-invalid={errorMessage ? "true" : "false"}
                  aria-describedby={`${amountHelpId}${
                    errorMessage ? ` ${errorId}` : ""
                  }`}
                  onChange={(event) =>
                    handleAmountChange(field.key, event.target.value)
                  }
                />
              </div>

              <div className="monthly-cost-message-slot">
                {errorMessage && (
                  <p
                    className="validation-message"
                    id={errorId}
                    role="status"
                  >
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>

      <div
        className={`monthly-cost-summary${
          calculation.isAvailable ? "" : " is-unavailable"
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="monthly-cost-summary-primary">
          <span>Estimated Monthly Total</span>
          <output aria-label="Estimated Monthly Total">
            {calculation.isAvailable
              ? formatCanadianCurrency(calculation.estimatedMonthlyTotal)
              : UNAVAILABLE_TOTAL}
          </output>
        </div>
        <div>
          <span>Advertised Rent</span>
          <output aria-label="Advertised Rent">
            {hasValidRent
              ? formatCanadianCurrency(housingCosts.advertisedRent)
              : UNAVAILABLE_TOTAL}
          </output>
        </div>
        <div>
          <span>Difference from Advertised Rent</span>
          <output aria-label="Difference from Advertised Rent">
            {calculation.isAvailable
              ? formatHousingCostDifference(
                  calculation.differenceFromAdvertisedRent,
                )
              : UNAVAILABLE_TOTAL}
          </output>
        </div>
        {!calculation.isAvailable && hasValidRent && (
          <p className="monthly-cost-summary-note">
            Correct the highlighted amount to see an updated total and
            difference.
          </p>
        )}
      </div>

      <div className="monthly-cost-footer">
        <details className="monthly-cost-assumptions">
          <summary>View default assumptions</summary>
          <p>
            These are starting points for planning, not official Toronto
            averages or guaranteed costs.
          </p>
          <dl>
            {HOUSING_COST_FIELDS.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>
                  {formatCanadianCurrency(defaultCosts.expenses[field.key])}
                  {defaultCosts.enabled[field.key]
                    ? ""
                    : " (not included by default)"}
                </dd>
              </div>
            ))}
          </dl>
        </details>

        <button
          type="button"
          className="secondary-button monthly-cost-reset"
          onClick={handleReset}
        >
          Reset to Defaults
        </button>
      </div>
    </section>
  );
}

function MonthlyHousingCostCalculator({ listingId, listingRent }) {
  return (
    <MonthlyHousingCostCalculatorForm
      key={getCalculatorKey(listingId, listingRent)}
      listingRent={listingRent}
    />
  );
}

export default MonthlyHousingCostCalculator;
