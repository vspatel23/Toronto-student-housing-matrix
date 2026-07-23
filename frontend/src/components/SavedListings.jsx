import ListingCard from "./ListingCard";
import StatusMessage from "./StatusMessage";
import { getListingId } from "../utils/listingFormatters";

function SavedListings({
  listings,
  campus,
  isLoading,
  errorMessage,
  onDetails,
  onBack,
  backLabel = "Back to Results",
  emptyActionLabel = "Browse Results",
  onRetry,
  savedListingIds,
  savingListingIds,
  onToggleSave,
  compareListingIds = [],
  onCompareListing,
  badgesByListingId = {},
  valueScoreWeights,
  onOpenCollections,
  onAddToCollection,
}) {
  const hasListings = listings.length > 0;

  return (
    <section className="saved-page" aria-labelledby="saved-title">
      <nav className="saved-navigation" aria-label="Saved Listings navigation">
        <button type="button" className="back-button" onClick={onBack}>
          {backLabel}
        </button>
      </nav>

      <header className="saved-page-header">
        <div>
          <p className="section-eyebrow">Your shortlist</p>
          <h1 id="saved-title">Saved Listings</h1>
          <p>
            Keep promising housing options together while you review details
            and compare trade-offs.
          </p>
        </div>
        <div className="collection-card-actions">
          <span className="saved-count-pill" aria-live="polite">
            <strong>{listings.length}</strong> saved
          </span>
          {onOpenCollections && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onOpenCollections}
            >
              Collections
            </button>
          )}
        </div>
      </header>

      {isLoading && !hasListings && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h2>Loading Saved Listings</h2>
            <p>Getting the housing options saved to your account.</p>
          </div>
        </div>
      )}

      {isLoading && hasListings && (
        <StatusMessage type="loading" className="saved-inline-status">
          Refreshing Saved Listings…
        </StatusMessage>
      )}

      {!isLoading && errorMessage && !hasListings && (
        <div className="state-panel error error-state" role="alert">
          <h2>Saved Listings are temporarily unavailable</h2>
          <p>{errorMessage}</p>
          {onRetry && (
            <div className="state-actions">
              <button type="button" className="details-button" onClick={onRetry}>
                Retry
              </button>
              <button type="button" className="secondary-button" onClick={onBack}>
                {backLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {!isLoading && errorMessage && hasListings && (
        <div className="saved-inline-error">
          <StatusMessage type="error">
            Saved Listings could not be refreshed. Your previously loaded
            shortlist is still available below.
          </StatusMessage>
          {onRetry && (
            <button type="button" className="secondary-button" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !errorMessage && !hasListings && (
        <div className="state-panel empty-state">
          <h2>No Saved Listings yet</h2>
          <p>
            Save a listing from your search results or Listing Details to add
            it to this shortlist.
          </p>
          <button type="button" className="details-button" onClick={onBack}>
            {emptyActionLabel}
          </button>
        </div>
      )}

      {hasListings && (
        <div className="saved-listing-grid">
          {listings.map((listing) => {
            const listingId = getListingId(listing);

            return (
              <ListingCard
                key={listingId}
                listing={listing}
                campus={campus}
                badges={badgesByListingId[listingId] || []}
                onDetails={onDetails}
                isSaved={savedListingIds?.has(listingId)}
                isSaving={savingListingIds?.has(listingId)}
                onToggleSave={onToggleSave}
                savedLabel="Remove saved"
                savingLabel="Removing..."
                isCompared={compareListingIds.includes(listingId)}
                onCompareListing={onCompareListing}
                onAddToCollection={onAddToCollection}
                valueScoreWeights={valueScoreWeights}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SavedListings;
