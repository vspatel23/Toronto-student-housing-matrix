import { formatDate } from "../utils/api";
import StatusMessage from "./StatusMessage";

const formatRentRange = (search) => {
  if (search.minRent == null && search.maxRent == null) {
    return "Not recorded";
  }

  const minimum = search.minRent == null ? "$0" : `$${search.minRent}`;
  const maximum = search.maxRent == null ? "No maximum" : `$${search.maxRent}`;
  return `${minimum} – ${maximum}`;
};

const getSearchHeading = (search) => {
  if (search.campus) {
    return search.campus;
  }

  if (search.housingType && search.housingType !== "All types") {
    return `${search.housingType} search`;
  }

  return "Housing search";
};

function RecentSearches({ searches = [], isLoading = false }) {
  return (
    <section className="recent-searches" aria-labelledby="recent-searches-title">
      <div className="section-heading-row">
        <div>
          <p className="section-eyebrow">Search history</p>
          <h2 id="recent-searches-title">Recent Searches</h2>
          <p>Your latest housing criteria, kept here for quick reference.</p>
        </div>
      </div>

      {isLoading && (
        <StatusMessage type="loading" className="recent-searches-state">
          Loading recent searches…
        </StatusMessage>
      )}

      {!isLoading && searches.length === 0 && (
        <StatusMessage type="empty" className="recent-searches-state">
          No recent searches yet. Your completed searches will appear here.
        </StatusMessage>
      )}

      {!isLoading && searches.length > 0 && (
        <div className="recent-search-list">
          {searches.map((search) => {
            const dateValue = search.updatedAt || search.createdAt;

            return (
              <article className="recent-search-item" key={search._id}>
                <div className="recent-search-heading">
                  <h3>{getSearchHeading(search)}</h3>
                  {dateValue && (
                    <time dateTime={dateValue}>{formatDate(dateValue)}</time>
                  )}
                </div>
                <dl className="recent-search-facts">
                  <div>
                    <dt>Housing type</dt>
                    <dd>{search.housingType || "All types"}</dd>
                  </div>
                  <div>
                    <dt>Rent</dt>
                    <dd>{formatRentRange(search)}</dd>
                  </div>
                  <div>
                    <dt>Commute</dt>
                    <dd>
                      {search.maxCommute ? `Up to ${search.maxCommute} min` : "Not recorded"}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RecentSearches;
