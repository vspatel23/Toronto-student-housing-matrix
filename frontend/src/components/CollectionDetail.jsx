import ListingCard from "./ListingCard";
import StatusMessage from "./StatusMessage";
import { getListingId } from "../utils/listingFormatters";

function CollectionDetail({
  collection,
  listings,
  campus,
  isLoading,
  errorMessage,
  onDetails,
  onBack,
  onRetry,
  savedListingIds,
  savingListingIds,
  onToggleSave,
  removingListingIds,
  onRemoveFromCollection,
  compareListingIds = [],
  onCompareListing,
  badgesByListingId = {},
  valueScoreWeights,
}) {
  const hasListings = listings.length > 0;

  return (
    <section className="saved-page" aria-labelledby="collection-detail-title">
      <nav className="saved-navigation" aria-label="Collection navigation">
        <button type="button" className="back-button" onClick={onBack}>
          Back to Collections
        </button>
      </nav>

      {isLoading && !collection && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h2>Loading Collection</h2>
            <p>Getting this collection's saved listings.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && !collection && (
        <div className="state-panel error error-state" role="alert">
          <h2>Collection unavailable</h2>
          <p>{errorMessage}</p>
          {onRetry && (
            <div className="state-actions">
              <button type="button" className="details-button" onClick={onRetry}>
                Retry
              </button>
              <button type="button" className="secondary-button" onClick={onBack}>
                Back to Collections
              </button>
            </div>
          )}
        </div>
      )}

      {collection && (
        <>
          <header className="saved-page-header">
            <div>
              <p className="section-eyebrow">Collection</p>
              <h1 id="collection-detail-title">{collection.name}</h1>
              {collection.description && <p>{collection.description}</p>}
            </div>
            <span className="saved-count-pill" aria-live="polite">
              <strong>{listings.length}</strong> listing
              {listings.length === 1 ? "" : "s"}
            </span>
          </header>

          {errorMessage && (
            <StatusMessage type="error">{errorMessage}</StatusMessage>
          )}

          {!hasListings && (
            <div className="state-panel empty-state">
              <h2>This collection is empty</h2>
              <p>
                Add listings to this collection from Saved Listings to see
                them here.
              </p>
              <button type="button" className="details-button" onClick={onBack}>
                Back to Collections
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
                    savedLabel="Unsave Listing"
                    savingLabel="Updating..."
                    isCompared={compareListingIds.includes(listingId)}
                    onCompareListing={onCompareListing}
                    onRemoveFromCollection={onRemoveFromCollection}
                    isRemovingFromCollection={removingListingIds?.has(
                      listingId,
                    )}
                    valueScoreWeights={valueScoreWeights}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default CollectionDetail;
