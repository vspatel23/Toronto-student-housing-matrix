export const LISTING_IMAGE_FALLBACK_SRC =
  "/images/listings/fallback/property-placeholder.svg";
export const LISTING_IMAGE_FALLBACK_ALT = "Property image unavailable";

const MAX_ALT_LENGTH = 240;
const MIN_ALT_LENGTH = 5;
const LOCAL_LISTING_IMAGE_PATTERN =
  /^\/images\/listings\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|jpe?g|png|svg|webp)$/;

export const LISTING_IMAGE_FALLBACK = Object.freeze({
  src: LISTING_IMAGE_FALLBACK_SRC,
  alt: LISTING_IMAGE_FALLBACK_ALT,
  order: 0,
  isPrimary: true,
  width: 1200,
  height: 800,
  isFallback: true,
});

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

export const isValidListingImageSource = (value) => {
  const src = normalizeString(value);

  if (!src) {
    return false;
  }

  if (LOCAL_LISTING_IMAGE_PATTERN.test(src)) {
    return true;
  }

  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export const isValidListingImageAlt = (value) => {
  const alt = normalizeString(value);
  return alt.length >= MIN_ALT_LENGTH && alt.length <= MAX_ALT_LENGTH;
};

const normalizePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const normalizeOrder = (value, fallbackOrder) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallbackOrder;
};

const normalizeListingImage = (image, fallbackOrder) => {
  if (!image || typeof image !== "object") {
    return null;
  }

  const src = normalizeString(image.src);
  const alt = normalizeString(image.alt);

  if (
    !isValidListingImageSource(src) ||
    !isValidListingImageAlt(alt)
  ) {
    return null;
  }

  if (src === LISTING_IMAGE_FALLBACK_SRC) {
    return LISTING_IMAGE_FALLBACK;
  }

  return {
    src,
    alt,
    order: normalizeOrder(image.order, fallbackOrder),
    isPrimary: image.isPrimary === true,
    width: normalizePositiveInteger(image.width),
    height: normalizePositiveInteger(image.height),
    isFallback: image.isFallback === true,
  };
};

export const getPrimaryListingImage = (listing) => {
  const normalizedPrimaryImage = normalizeListingImage(
    listing?.primaryImage,
    0,
  );

  if (normalizedPrimaryImage) {
    return normalizedPrimaryImage;
  }

  if (!Array.isArray(listing?.images)) {
    return LISTING_IMAGE_FALLBACK;
  }

  const normalizedImages = listing.images
    .map((image, index) => {
      const normalizedImage = normalizeListingImage(image, index);
      return normalizedImage
        ? { image: normalizedImage, originalIndex: index }
        : null;
    })
    .filter(Boolean)
    .sort(
      (firstImage, secondImage) =>
        firstImage.image.order - secondImage.image.order ||
        firstImage.originalIndex - secondImage.originalIndex,
    );

  if (normalizedImages.length === 0) {
    return LISTING_IMAGE_FALLBACK;
  }

  return (
    normalizedImages.find(({ image }) => image.isPrimary)?.image ||
    normalizedImages[0].image
  );
};

export const applyListingImageFallback = (imageElement) => {
  if (
    !imageElement ||
    imageElement.dataset?.fallbackApplied === "true"
  ) {
    return false;
  }

  imageElement.dataset.fallbackApplied = "true";

  const currentSource =
    imageElement.getAttribute?.("src") || imageElement.src || "";
  if (
    currentSource === LISTING_IMAGE_FALLBACK.src ||
    currentSource.endsWith(LISTING_IMAGE_FALLBACK.src)
  ) {
    return false;
  }

  imageElement.src = LISTING_IMAGE_FALLBACK.src;
  imageElement.alt = LISTING_IMAGE_FALLBACK.alt;
  return true;
};
