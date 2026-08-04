import { useEffect, useReducer } from "react";
import {
  getAccessibleListingImageAlt,
  getListingImageFallback,
  getPrimaryListingImage,
  LISTING_IMAGE_FALLBACK,
} from "../utils/listingImages";
import {
  createListingImageState,
  listingImageStateReducer,
} from "../utils/listingImageState";

const supportedVariants = new Set([
  "card",
  "detail",
  "gallery",
  "thumbnail",
  "viewer",
]);

function ListingImage({
  listing,
  image: providedImage,
  variant = "card",
  className = "",
  loading,
}) {
  const image = providedImage || getPrimaryListingImage(listing);
  const fallbackImage = getListingImageFallback(listing);
  const safeVariant = supportedVariants.has(variant) ? variant : "card";
  const loadingStrategy =
    loading ||
    (safeVariant === "detail" ||
    safeVariant === "gallery" ||
    safeVariant === "viewer"
      ? "eager"
      : "lazy");
  const classes = [
    "listing-image",
    `listing-image--${safeVariant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const [storedImageState, dispatchImageState] = useReducer(
    listingImageStateReducer,
    image.src,
    createListingImageState,
  );
  const imageState =
    storedImageState.source === image.src
      ? storedImageState
      : createListingImageState(image.src);

  useEffect(() => {
    dispatchImageState({ type: "reset", source: image.src });
  }, [image.src]);

  const displayedImageSource = imageState.hasFailed ? fallbackImage : image;
  const displayedImage = {
    ...displayedImageSource,
    alt: getAccessibleListingImageAlt(displayedImageSource, listing, {
      isFallback: imageState.hasFailed || displayedImageSource.isFallback,
    }),
  };
  const unavailableAlt = fallbackImage.alt;

  const handleImageLoad = () => {
    dispatchImageState({ type: "load", source: image.src });
  };

  const handleImageError = () => {
    dispatchImageState({
      type: "error",
      source: image.src,
      isFallbackSource: image.src === LISTING_IMAGE_FALLBACK.src,
    });
  };

  return (
    <div
      className={`${classes}${imageState.isLoading ? " is-loading" : ""}${
        imageState.hasFailed ? " has-fallback" : ""
      }`}
      aria-busy={imageState.isLoading ? "true" : undefined}
    >
      {imageState.isLoading && (
        <span className="listing-image__placeholder" aria-hidden="true" />
      )}
      {imageState.fallbackUnavailable ? (
        <span
          className="listing-image__unavailable"
          role="img"
          aria-label={unavailableAlt}
        >
          Image unavailable
        </span>
      ) : (
        <img
          key={displayedImage.src}
          src={displayedImage.src}
          alt={displayedImage.alt}
          width={displayedImage.width}
          height={displayedImage.height}
          loading={loadingStrategy}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
    </div>
  );
}

export default ListingImage;
