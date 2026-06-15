function ResultsList({ listings, hasSearched }) {
  if (!hasSearched) {
    return null;
  }

  return (
    <section className="results-panel" aria-label="Housing results">
      <h3>Housing Results</h3>
      {listings.length > 0 ? (
        <div className="results-grid">
          {listings.map((listing) => (
            <article key={listing._id} className="result-item">
              <div>
                <strong>{listing.title || "Untitled listing"}</strong>
                <span>
                  {listing.neighborhood || listing.address || "Toronto"}
                </span>
              </div>
              <p>
                ${listing.monthlyRent || "N/A"} ·{" "}
                {listing.propertyType || "Housing"} ·{" "}
                {listing.furnished ? "Furnished" : "Unfurnished"}
              </p>
              <small>
                Safety: {listing.safety?.crimeRateLevel || "Unknown"} ·
                Value score: {listing.valueScore || "N/A"}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-results">
          No listings match these filters yet.
        </p>
      )}
    </section>
  );
}

export default ResultsList;
