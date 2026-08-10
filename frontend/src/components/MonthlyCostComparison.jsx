import { useId, useMemo, useState } from "react";

import {
  HOUSING_COST_FIELDS,
  calculateComparisonMonthlyCosts,
  createDefaultHousingCostAssumptions,
  formatCanadianCurrency,
  formatHousingCostDifference,
  resetHousingCostAssumptions,
  setHousingCostEnabled,
  updateHousingCostAmount,
} from "../utils/monthlyHousingCost";
import {
  getListingId,
  getListingTitle,
} from "../utils/listingFormatters";

const UNAVAILABLE_AMOUNT = "Unavailable";

const getAdvertisedRent = (listing) =>
  listing?.monthlyRent ?? listing?.rent;

function MonthlyCostComparison({ listings = [] }) {
  const generatedId = useId().replaceAll(":", "");
  const amountHelpId = `${generatedId}-amount-help`;
  const [assumptions, setAssumptions] = useState(() =>
    createDefaultHousingCostAssumptions(),
  );
  const listingRents = useMemo(
    () => listings.map((listing) => getAdvertisedRent(listing)),
    [listings],
  );
  const comparison = useMemo(
    () => calculateComparisonMonthlyCosts(listingRents, assumptions),
    [assumptions, listingRents],
  );
  const fieldErrors = comparison.calculations[0]?.fieldErrors || {};

  if (listings.length === 0) {
    return null;
  }

  const handleAmountChange = (fieldKey, amount) => {
    setAssumptions((currentAssumptions) =>
      updateHousingCostAmount(currentAssumptions, fieldKey, amount),
    );
  };

  const handleEnabledChange = (fieldKey, enabled) => {
    setAssumptions((currentAssumptions) =>
      setHousingCostEnabled(currentAssumptions, fieldKey, enabled),
    );
  };

  const handleReset = () => {
    setAssumptions(resetHousingCostAssumptions());
  };

  return (
    <section
      className="monthly-cost-comparison"
      aria-labelledby={`${generatedId}-title`}
    >
      <header className="monthly-cost-comparison-header">
        <div>
          <p className="section-eyebrow">Shared planning estimate</p>
          <h2 id={`${generatedId}-title`}>Estimated Monthly Cost</h2>
        </div>
        <p>
          Advertised rent comes from each listing. Every other amount below is
          one shared planning assumption applied equally to all selected
          listings.
        </p>
      </header>

      <div className="monthly-cost-comparison-assumptions">
        <div className="monthly-cost-comparison-assumptions-header">
          <div>
            <h3 id={`${generatedId}-assumptions-title`}>
              Monthly Cost Assumptions
            </h3>
            <p id={`${generatedId}-assumptions-description`}>
              Edit one value or inclusion toggle to update every applicable
              listing immediately. Amounts are monthly Canadian-dollar
              estimates, not guaranteed costs.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button monthly-cost-reset"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>

        <fieldset
          className="monthly-cost-fields monthly-cost-comparison-fields"
          aria-labelledby={`${generatedId}-assumptions-title`}
          aria-describedby={`${generatedId}-assumptions-description`}
        >
          <legend className="visually-hidden">
            Shared monthly expense estimates
          </legend>
          <p className="visually-hidden" id={amountHelpId}>
            Enter monthly amounts in Canadian dollars. These values apply to
            every selected listing.
          </p>
          {HOUSING_COST_FIELDS.map((field) => {
            const inputId = `${generatedId}-${field.key}`;
            const errorId = `${inputId}-error`;
            const enabled = field.optional
              ? assumptions.enabled[field.key]
              : true;
            const errorMessage = fieldErrors[field.key] || "";

            return (
              <div
                className={`monthly-cost-field${
                  enabled ? "" : " is-disabled"
                }`}
                key={field.key}
              >
                <div className="monthly-cost-field-heading">
                  <label htmlFor={inputId}>{field.label}</label>
                  {field.optional && (
                    <label className="monthly-cost-toggle">
                      <input
                        type="checkbox"
                        checked={enabled}
                        aria-label={`Include ${field.label} for all listings`}
                        onChange={(event) =>
                          handleEnabledChange(
                            field.key,
                            event.target.checked,
                          )
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
                    value={assumptions.expenses[field.key]}
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
      </div>

      <div
        className="monthly-cost-comparison-results"
        aria-label="Estimated monthly costs by listing"
        role="list"
      >
        {listings.map((listing, index) => {
          const listingId = getListingId(listing);
          const listingTitle = getListingTitle(listing);
          const calculation = comparison.calculations[index];
          const titleId = `${generatedId}-listing-${index}`;

          return (
            <article
              key={listingId || `${listingTitle}-${index}`}
              className={`monthly-cost-comparison-card${
                calculation.isLowest ? " is-lowest" : ""
              }${calculation.isLowestTie ? " is-tied" : ""}`}
              aria-labelledby={titleId}
              role="listitem"
            >
              <header>
                <h3 id={titleId}>{listingTitle}</h3>
                {calculation.isLowest && (
                  <span className="monthly-cost-lowest-badge">
                    {calculation.isLowestTie
                      ? "Lowest Total — Tie"
                      : "Lowest Total"}
                  </span>
                )}
              </header>

              <dl>
                <div>
                  <dt>Advertised Rent</dt>
                  <dd>
                    <output aria-label={`${listingTitle}, Advertised Rent`}>
                      {calculation.advertisedRent === null
                        ? UNAVAILABLE_AMOUNT
                        : formatCanadianCurrency(
                            calculation.advertisedRent,
                          )}
                    </output>
                  </dd>
                </div>
                <div>
                  <dt>Additional Estimated Monthly Expenses</dt>
                  <dd>
                    <output
                      aria-label={`${listingTitle}, Additional Estimated Monthly Expenses`}
                    >
                      {calculation.expenseTotal === null
                        ? UNAVAILABLE_AMOUNT
                        : formatHousingCostDifference(
                            calculation.expenseTotal,
                          )}
                    </output>
                  </dd>
                </div>
                <div className="monthly-cost-comparison-total">
                  <dt>Estimated Monthly Total</dt>
                  <dd>
                    <output
                      aria-label={`${listingTitle}, Estimated Monthly Total`}
                    >
                      {calculation.isAvailable
                        ? formatCanadianCurrency(
                            calculation.estimatedMonthlyTotal,
                          )
                        : UNAVAILABLE_AMOUNT}
                    </output>
                  </dd>
                </div>
                <div>
                  <dt>Difference from Lowest</dt>
                  <dd>
                    <output
                      aria-label={`${listingTitle}, Difference from Lowest`}
                    >
                      {calculation.differenceFromLowest === null
                        ? UNAVAILABLE_AMOUNT
                        : formatHousingCostDifference(
                            calculation.differenceFromLowest,
                          )}
                    </output>
                  </dd>
                </div>
              </dl>

              {!calculation.isAvailable && (
                <p className="monthly-cost-comparison-unavailable" role="status">
                  {calculation.unavailableReason}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {comparison.lowestEstimatedMonthlyTotal === null && (
        <p className="monthly-cost-comparison-no-valid-total" role="status">
          No valid estimated monthly totals are available. Correct any shared
          assumption errors or check the advertised rents.
        </p>
      )}
    </section>
  );
}

export default MonthlyCostComparison;
