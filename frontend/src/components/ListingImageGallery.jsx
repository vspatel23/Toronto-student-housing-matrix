import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampListingImageIndex,
  getAdjacentListingImageIndex,
  getInitialListingImageIndex,
  normalizeListingImages,
} from "../utils/listingImages";
import { getListingTitle } from "../utils/listingFormatters";
import ListingImage from "./ListingImage";
import ListingImageViewer from "./ListingImageViewer";

function ListingImageGallery({ listing }) {
  const images = useMemo(() => normalizeListingImages(listing), [listing]);
  const [currentIndex, setCurrentIndex] = useState(() =>
    getInitialListingImageIndex(images),
  );
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const viewerTriggerRef = useRef(null);
  const shouldRestoreFocusRef = useRef(false);
  const safeIndex = clampListingImageIndex(currentIndex, images.length);
  const currentImage = images[safeIndex];
  const listingTitle = getListingTitle(listing);
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < images.length - 1;

  useEffect(() => {
    if (isViewerOpen) {
      shouldRestoreFocusRef.current = true;
      return;
    }

    if (shouldRestoreFocusRef.current) {
      viewerTriggerRef.current?.focus();
      shouldRestoreFocusRef.current = false;
    }
  }, [isViewerOpen]);

  const showAdjacentImage = (direction) => {
    const nextIndex = getAdjacentListingImageIndex(
      safeIndex,
      direction,
      images.length,
    );

    if (nextIndex !== safeIndex) {
      setCurrentIndex(nextIndex);
    }
  };

  const openViewer = (event) => {
    viewerTriggerRef.current = event.currentTarget;
    setIsViewerOpen(true);
  };

  return (
    <section
      className="listing-gallery"
      aria-label={`Property images for ${listingTitle}`}
    >
      <div className="listing-gallery__main">
        <button
          type="button"
          className="listing-gallery__main-button"
          aria-label={`View image full screen: ${currentImage.alt}`}
          onClick={openViewer}
        >
          <ListingImage
            key={currentImage.id}
            image={currentImage}
            variant="gallery"
            className="listing-gallery__image"
            loading="eager"
          />
          <span className="listing-gallery__full-screen-label" aria-hidden="true">
            View full screen
          </span>
        </button>

        <button
          type="button"
          className="listing-gallery__nav listing-gallery__nav--previous"
          aria-label="Previous listing image"
          disabled={!canGoPrevious}
          onClick={() => showAdjacentImage(-1)}
        >
          <span className="listing-gallery__nav-icon" aria-hidden="true">‹</span>
          <span className="listing-gallery__nav-text">Previous</span>
        </button>
        <button
          type="button"
          className="listing-gallery__nav listing-gallery__nav--next"
          aria-label="Next listing image"
          disabled={!canGoNext}
          onClick={() => showAdjacentImage(1)}
        >
          <span className="listing-gallery__nav-text">Next</span>
          <span className="listing-gallery__nav-icon" aria-hidden="true">›</span>
        </button>

        <p
          className="listing-gallery__counter"
          aria-live="polite"
          aria-atomic="true"
        >
          {safeIndex + 1} / {images.length}
        </p>
      </div>

      {images.length > 1 && (
        <ol
          className="listing-gallery__thumbnail-list"
          aria-label="Choose a listing image"
        >
          {images.map((image, index) => {
            const isSelected = index === safeIndex;

            return (
              <li key={image.id}>
                <button
                  type="button"
                  className={`listing-gallery__thumbnail${
                    isSelected ? " listing-gallery__thumbnail--selected" : ""
                  }`}
                  aria-label={`View image ${index + 1} of ${images.length}: ${
                    image.alt
                  }`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => setCurrentIndex(index)}
                >
                  <ListingImage
                    image={image}
                    variant="thumbnail"
                    loading="lazy"
                  />
                  {isSelected && (
                    <span className="listing-gallery__selected-marker">
                      Selected
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {isViewerOpen && (
        <ListingImageViewer
          images={images}
          currentIndex={safeIndex}
          onCurrentIndexChange={setCurrentIndex}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </section>
  );
}

export default ListingImageGallery;
