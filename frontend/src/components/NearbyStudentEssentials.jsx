import {
  getNearbyPlaceCategoryLabel,
  getNearbyPlaceCategoryMarkerGlyph,
  NEARBY_PLACE_CATEGORIES,
} from "../utils/nearbyPlaceCategories";
import { formatStraightLineDistanceKm } from "../utils/mapCoordinates";

const ALL_CATEGORIES = { id: "all", label: "All" };
const FILTER_OPTIONS = [ALL_CATEGORIES, ...NEARBY_PLACE_CATEGORIES];

function NearbyPlaceRow({
  place,
  isSelected,
  onSelectPlace,
  registerPlaceItem,
}) {
  const categoryLabel = getNearbyPlaceCategoryLabel(place.category);
  const markerGlyph = getNearbyPlaceCategoryMarkerGlyph(place.category);
  const distanceLabel = formatStraightLineDistanceKm(place.distanceKm);
  const address =
    typeof place.address === "string" ? place.address.trim() : "";

  return (
    <li className="nearby-place-item">
      <button
        ref={(node) => registerPlaceItem(place.id, node)}
        type="button"
        className="nearby-place-button"
        aria-pressed={isSelected}
        onClick={() => onSelectPlace(place.id, { source: "list" })}
      >
        <span className="nearby-place-name-row">
          <strong>{place.name}</strong>
          {isSelected && (
            <span className="nearby-place-selected-cue">
              <span aria-hidden="true">✓</span>
              Selected
            </span>
          )}
        </span>

        <span className="nearby-place-meta">
          <span className="nearby-place-category">
            <span className="nearby-place-category-glyph" aria-hidden="true">
              {markerGlyph}
            </span>
            {categoryLabel}
          </span>
          <span
            className="nearby-place-distance"
            aria-label={`${distanceLabel} straight-line distance`}
          >
            {distanceLabel}
          </span>
        </span>

        {address && <span className="nearby-place-address">{address}</span>}
      </button>
    </li>
  );
}

function NearbyStudentEssentials({
  status,
  places,
  totalPlaceCount,
  filteredPlaceCount,
  activeCategory,
  sortOrder,
  selectedPlaceId,
  hasMorePlaces,
  onCategoryChange,
  onSortOrderChange,
  onSelectPlace,
  onShowMore,
  onRetry,
  registerPlaceItem,
}) {
  const isReady = status === "ready";
  const hasLoadedPlaces = isReady && totalPlaceCount > 0;

  return (
    <section
      className="detail-section nearby-essentials-section"
      aria-labelledby="nearby-essentials-title"
    >
      <div className="nearby-essentials-heading">
        <div>
          <p className="section-eyebrow">Student convenience</p>
          <h2 id="nearby-essentials-title">Nearby Student Essentials</h2>
          <p>Everyday places near this listing.</p>
          <p className="nearby-essentials-distance-note">
            Distances are straight-line estimates.
          </p>
          <p className="nearby-essentials-data-credit">
            Seeded place data includes{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              © OpenStreetMap contributors
            </a>
            .
          </p>
        </div>
      </div>

      {status === "unavailable" && (
        <div className="nearby-essentials-state" role="status">
          <p>
            Nearby places are unavailable because this listing has no location
            coordinates.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div
          className="nearby-essentials-state nearby-essentials-loading"
          role="status"
          aria-live="polite"
        >
          <span className="spinner" aria-hidden="true"></span>
          <p>Finding nearby student essentials...</p>
        </div>
      )}

      {status === "error" && (
        <div
          className="nearby-essentials-state nearby-essentials-error"
          role="alert"
        >
          <div>
            <h3>Nearby places unavailable</h3>
            <p>We couldn&apos;t load nearby places right now.</p>
          </div>
          <button
            type="button"
            className="secondary-button nearby-essentials-retry"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}

      {isReady && totalPlaceCount === 0 && (
        <div className="nearby-essentials-state" role="status">
          <p>No nearby student essentials were found for this listing.</p>
        </div>
      )}

      {hasLoadedPlaces && (
        <>
          <div className="nearby-essentials-controls">
            <fieldset className="nearby-category-filter">
              <legend>Filter by category</legend>
              <div className="nearby-category-options">
                {FILTER_OPTIONS.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="nearby-category-filter-button"
                    aria-pressed={activeCategory === category.id}
                    onClick={() => onCategoryChange(category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="nearby-sort-control">
              <span>Sort by distance</span>
              <select
                value={sortOrder}
                onChange={(event) => onSortOrderChange(event.target.value)}
              >
                <option value="nearest">Nearest first</option>
                <option value="farthest">Farthest first</option>
              </select>
            </label>
          </div>

          <p
            className="nearby-results-summary"
            id="nearby-results-summary"
            aria-live="polite"
          >
            Showing {places.length} of {filteredPlaceCount} nearby{" "}
            {filteredPlaceCount === 1 ? "place" : "places"}
          </p>

          {filteredPlaceCount === 0 ? (
            <div className="nearby-essentials-state" role="status">
              <p>No nearby student essentials match this category.</p>
            </div>
          ) : (
            <ul
              className="nearby-place-list"
              aria-label="Nearby student essentials"
              aria-describedby="nearby-results-summary"
            >
              {places.map((place) => (
                <NearbyPlaceRow
                  key={place.id}
                  place={place}
                  isSelected={selectedPlaceId === place.id}
                  onSelectPlace={onSelectPlace}
                  registerPlaceItem={registerPlaceItem}
                />
              ))}
            </ul>
          )}

          {hasMorePlaces && (
            <button
              type="button"
              className="secondary-button nearby-show-more"
              onClick={onShowMore}
            >
              Show More
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default NearbyStudentEssentials;
