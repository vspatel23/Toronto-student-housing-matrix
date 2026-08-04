import { useMemo, useState } from "react";
import {
  clampListingImageIndex,
  getAdjacentListingImageIndex,
  getInitialListingImageIndex,
  normalizeListingImages,
} from "../utils/listingImages";
import { getListingTitle } from "../utils/listingFormatters";
import ListingImage from "./ListingImage";

function ListingCardImageGallery({ listing }) {
  const images = useMemo(() => normalizeListingImages(listing), [listing]);
  const [currentIndex, setCurrentIndex] = useState(() =>
    getInitialListingImageIndex(images),
  );
  const safeIndex = clampListingImageIndex(currentIndex, images.length);
  const currentImage = images[safeIndex];
  const listingTitle = getListingTitle(listing);
  const hasMultipleImages = images.length > 1;

  const showAdjacentImage = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((index) =>
      getAdjacentListingImageIndex(index, direction, images.length),
    );
  };

  return (
    <div
      className="listing-card-gallery"
      aria-label={`Property images for ${listingTitle}`}
    >
      <ListingImage
        key={currentImage.id}
        listing={listing}
        image={currentImage}
        variant="card"
        className="listing-card-gallery__image"
      />

      {hasMultipleImages && (
        <>
          <button
            type="button"
            className="listing-card-gallery__nav listing-card-gallery__nav--previous"
            aria-label={`Previous image for ${listingTitle}`}
            disabled={safeIndex === 0}
            onClick={(event) => showAdjacentImage(event, -1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="listing-card-gallery__nav listing-card-gallery__nav--next"
            aria-label={`Next image for ${listingTitle}`}
            disabled={safeIndex === images.length - 1}
            onClick={(event) => showAdjacentImage(event, 1)}
          >
            <span aria-hidden="true">›</span>
          </button>
          <p
            className="listing-card-gallery__counter"
            aria-live="polite"
            aria-atomic="true"
          >
            {safeIndex + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}

export default ListingCardImageGallery;
