import { useState } from "react";
import {
  getPrimaryListingImage,
  LISTING_IMAGE_FALLBACK,
} from "../utils/listingImages";

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
  const [imageState, setImageState] = useState(() => ({
    source: image.src,
    isLoading: true,
    hasFailed: false,
    fallbackUnavailable: false,
  }));

  if (imageState.source !== image.src) {
    setImageState({
      source: image.src,
      isLoading: true,
      hasFailed: false,
      fallbackUnavailable: false,
    });
  }

  const displayedImage = imageState.hasFailed
    ? {
        ...LISTING_IMAGE_FALLBACK,
        alt: `Property image unavailable. ${image.alt}`,
      }
    : image;
  const unavailableAlt = image.isFallback
    ? image.alt
    : `Property image unavailable. ${image.alt}`;

  const handleImageLoad = () => {
    setImageState((current) => ({
      ...current,
      isLoading: false,
    }));
  };

  const handleImageError = () => {
    setImageState((current) => {
      if (current.hasFailed || image.src === LISTING_IMAGE_FALLBACK.src) {
        return {
          ...current,
          isLoading: false,
          fallbackUnavailable: true,
        };
      }

      return {
        ...current,
        isLoading: true,
        hasFailed: true,
      };
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
