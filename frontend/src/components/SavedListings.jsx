import { ListingCard } from "./BrowseResults";
import { getListingId } from "../utils/listingFormatters";

function SavedListings({
  listings,
  isLoading,
  errorMessage,
  onDetails,
  onBack,
  onRetry,
  savedListingIds,
  savingListingIds,
  onToggleSave,
}) {
  return (
    <section className="browse-page" aria-labelledby="saved-title">
      <div className="active-search-bar">
        <div className="active-search-content">
          <strong>Saved Listings</strong>
          <span className="muted-text">
            Listings you have bookmarked for later.
          </span>
        </div>
        <button type="button" className="link-button strong" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="results-title-row">
        <div>
          <h2 id="saved-title">Your Saved Listings</h2>
          <p>
            {listings.length} listing{listings.length === 1 ? "" : "s"} saved
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h3>Loading saved listings</h3>
            <p>Fetching the listings you have bookmarked.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-panel error" role="alert">
          <h3>Saved listings could not be loaded</h3>
          <p>{errorMessage}</p>
          <div className="state-actions">
            <button type="button" className="details-button" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !errorMessage && listings.length === 0 && (
        <div className="state-panel empty-state">
          <h3>No saved listings yet</h3>
          <p>
            Browse housing results and select "Save" on a listing to bookmark
            it for later.
          </p>
          <button type="button" className="secondary-button" onClick={onBack}>
            Back to Results
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && listings.length > 0 && (
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard
              key={getListingId(listing)}
              listing={listing}
              onDetails={onDetails}
              isSaved={savedListingIds?.has(getListingId(listing))}
              isSaving={savingListingIds?.has(getListingId(listing))}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default SavedListings;
