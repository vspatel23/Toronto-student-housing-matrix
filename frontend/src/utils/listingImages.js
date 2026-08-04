export const LISTING_IMAGE_FALLBACK_SRC =
  "/images/listings/fallback/property-placeholder.svg";
export const LISTING_IMAGE_FALLBACK_ALT = "Property image unavailable";

const MAX_ALT_LENGTH = 240;
const MIN_ALT_LENGTH = 5;
const LOCAL_LISTING_IMAGE_PATTERN =
  /^\/images\/listings\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|jpe?g|png|svg|webp)$/;
const IMAGE_FILENAME_ALT_PATTERN =
  /(?:^|[/\\])[^/\\]+\.(?:avif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

export const LISTING_IMAGE_FALLBACK = Object.freeze({
  id: "listing-image-fallback",
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

const getListingName = (listing) =>
  normalizeString(listing?.title || listing?.name) || "this listing";

const getStableImageId = (image, src, order) => {
  const providedId = normalizeString(image?.id || image?._id);
  return providedId || `${src}::${order}`;
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
    id: getStableImageId(image, src, normalizeOrder(image.order, fallbackOrder)),
    src,
    alt,
    order: normalizeOrder(image.order, fallbackOrder),
    isPrimary: image.isPrimary === true,
    width: normalizePositiveInteger(image.width),
    height: normalizePositiveInteger(image.height),
    isFallback: image.isFallback === true,
  };
};

export const getListingImageFallback = (listing) => {
  const listingName = getListingName(listing);

  if (listingName === "this listing") {
    return LISTING_IMAGE_FALLBACK;
  }

  return {
    ...LISTING_IMAGE_FALLBACK,
    alt: `No property image available for ${listingName}`,
  };
};

export const getAccessibleListingImageAlt = (
  image,
  listing,
  { isFallback = image?.isFallback === true } = {},
) => {
  if (isFallback) {
    return getListingImageFallback(listing).alt;
  }

  const alt = normalizeString(image?.alt);

  if (isValidListingImageAlt(alt) && !IMAGE_FILENAME_ALT_PATTERN.test(alt)) {
    return alt;
  }

  const listingName = getListingName(listing);
  return listingName === "this listing"
    ? "Primary property image"
    : `Primary image for ${listingName}`;
};

export const normalizeListingImages = (listingOrImages) => {
  const listing = Array.isArray(listingOrImages)
    ? { images: listingOrImages }
    : listingOrImages && typeof listingOrImages === "object"
      ? listingOrImages
      : {};
  const normalizedPrimaryImage = normalizeListingImage(
    listing.primaryImage,
    0,
  );
  const normalizedImages = (Array.isArray(listing.images)
    ? listing.images
    : []
  )
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
    )
    .map(({ image }) => image);

  if (
    normalizedPrimaryImage &&
    !normalizedPrimaryImage.isFallback &&
    !normalizedImages.some(
      (image) =>
        image.src === normalizedPrimaryImage.src &&
        image.order === normalizedPrimaryImage.order,
    )
  ) {
    normalizedImages.push(normalizedPrimaryImage);
    normalizedImages.sort(
      (firstImage, secondImage) => firstImage.order - secondImage.order,
    );
  }

  if (normalizedImages.length === 0) {
    return [getListingImageFallback(listing)];
  }

  const primaryFromConvenienceField = normalizedPrimaryImage
    ? normalizedImages.findIndex(
        (image) =>
          image.src === normalizedPrimaryImage.src &&
          image.order === normalizedPrimaryImage.order,
      )
    : -1;
  const firstExplicitPrimary = normalizedImages.findIndex(
    (image) => image.isPrimary,
  );
  const primaryIndex =
    primaryFromConvenienceField >= 0
      ? primaryFromConvenienceField
      : firstExplicitPrimary >= 0
        ? firstExplicitPrimary
        : 0;

  return normalizedImages.map((image, index) => ({
    ...image,
    isPrimary: index === primaryIndex,
  }));
};

export const getInitialListingImageIndex = (images) => {
  if (!Array.isArray(images) || images.length === 0) {
    return 0;
  }

  const primaryIndex = images.findIndex((image) => image?.isPrimary === true);
  return primaryIndex >= 0 ? primaryIndex : 0;
};

export const clampListingImageIndex = (index, imageCount) => {
  const lastIndex = Math.max(0, Number(imageCount) - 1);
  const numericIndex = Number(index);

  if (!Number.isInteger(numericIndex)) {
    return 0;
  }

  return Math.min(Math.max(numericIndex, 0), lastIndex);
};

export const getAdjacentListingImageIndex = (
  currentIndex,
  direction,
  imageCount,
) => {
  const safeIndex = clampListingImageIndex(currentIndex, imageCount);

  if (imageCount <= 1 || ![-1, 1].includes(direction)) {
    return safeIndex;
  }

  return clampListingImageIndex(safeIndex + direction, imageCount);
};

export const getPrimaryListingImage = (listing) => {
  const normalizedPrimaryImage = normalizeListingImage(
    listing?.primaryImage,
    0,
  );

  if (normalizedPrimaryImage) {
    return normalizedPrimaryImage;
  }

  const normalizedImages = normalizeListingImages(listing);
  return normalizedImages[getInitialListingImageIndex(normalizedImages)];
};
