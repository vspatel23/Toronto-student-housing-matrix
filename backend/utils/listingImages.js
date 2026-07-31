const FALLBACK_IMAGE = Object.freeze({
  src: "/images/listings/fallback/property-placeholder.svg",
  alt: "Property image unavailable",
  order: 0,
  isPrimary: true,
  width: 1200,
  height: 800,
  isFallback: true,
});

const LISTING_FIELDS =
  "_id title address neighborhood postalCode description monthlyRent propertyType bedrooms bathrooms furnished location safety commuteEstimates nearestTransit amenities valueScore source isActive images";

const MAX_IMAGE_ALT_LENGTH = 240;
const MIN_IMAGE_ALT_LENGTH = 5;
const LOCAL_IMAGE_SOURCE_PATTERN =
  /^\/images\/listings\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|jpe?g|png|svg|webp)$/;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const isAllowedListingImageSource = (value) => {
  const source = normalizeText(value);

  if (!source) {
    return false;
  }

  if (LOCAL_IMAGE_SOURCE_PATTERN.test(source)) {
    return true;
  }

  try {
    const url = new URL(source);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
};

const assertPositiveInteger = (value, fieldName, context) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${context}: ${fieldName} must be a positive integer.`);
  }

  return value;
};

const prepareListingImagesForStorage = (
  images,
  { context = "Listing images", allowMissing = true } = {},
) => {
  if (images === undefined || images === null) {
    if (allowMissing) {
      return [];
    }

    throw new Error(`${context}: at least one image is required.`);
  }

  if (!Array.isArray(images)) {
    throw new Error(`${context}: images must be an array.`);
  }

  if (images.length === 0) {
    if (allowMissing) {
      return [];
    }

    throw new Error(`${context}: at least one image is required.`);
  }

  const normalizedImages = images.map((rawImage, index) => {
    const image =
      typeof rawImage?.toObject === "function"
        ? rawImage.toObject({ depopulate: true })
        : rawImage;
    const imageContext = `${context}, image ${index}`;

    if (!isPlainObject(image)) {
      throw new Error(`${imageContext}: image metadata must be an object.`);
    }

    const src = normalizeText(image.src);
    const alt = normalizeText(image.alt);
    const order = image.order === undefined || image.order === null ? index : image.order;

    if (!src) {
      throw new Error(`${imageContext}: src is required.`);
    }

    if (!isAllowedListingImageSource(src)) {
      throw new Error(
        `${imageContext}: src must be an approved /images/listings/ path or an HTTPS URL.`,
      );
    }

    if (!alt) {
      throw new Error(`${imageContext}: alt text is required.`);
    }

    if (
      alt.length < MIN_IMAGE_ALT_LENGTH ||
      alt.length > MAX_IMAGE_ALT_LENGTH
    ) {
      throw new Error(
        `${imageContext}: alt text must be ${MIN_IMAGE_ALT_LENGTH}-${MAX_IMAGE_ALT_LENGTH} characters.`,
      );
    }

    if (!Number.isInteger(order) || order < 0) {
      throw new Error(`${imageContext}: order must be a non-negative integer.`);
    }

    if (
      image.isPrimary !== undefined &&
      image.isPrimary !== null &&
      typeof image.isPrimary !== "boolean"
    ) {
      throw new Error(`${imageContext}: isPrimary must be a boolean.`);
    }

    return {
      src,
      alt,
      order,
      isPrimary: image.isPrimary === true,
      width: assertPositiveInteger(image.width, "width", imageContext),
      height: assertPositiveInteger(image.height, "height", imageContext),
    };
  });

  const usedOrders = new Set();
  normalizedImages.forEach((image, index) => {
    if (usedOrders.has(image.order)) {
      throw new Error(
        `${context}, image ${index}: order ${image.order} is duplicated.`,
      );
    }
    usedOrders.add(image.order);
  });

  const primaryCount = normalizedImages.filter((image) => image.isPrimary).length;
  if (primaryCount > 1) {
    throw new Error(`${context}: no more than one image may be primary.`);
  }

  const sortedImages = normalizedImages
    .map((image, originalIndex) => ({ image, originalIndex }))
    .sort(
      (first, second) =>
        first.image.order - second.image.order ||
        first.originalIndex - second.originalIndex,
    )
    .map(({ image }) => image);
  const primaryIndex =
    primaryCount === 1
      ? sortedImages.findIndex((image) => image.isPrimary)
      : sortedImages.length > 0
        ? 0
        : -1;

  return sortedImages.map((image, index) => ({
    ...image,
    isPrimary: index === primaryIndex,
  }));
};

const normalizeLegacyImage = (rawImage, index) => {
  if (!isPlainObject(rawImage)) {
    return null;
  }

  const src = normalizeText(rawImage.src);
  const alt = normalizeText(rawImage.alt);
  const order =
    rawImage.order === undefined || rawImage.order === null
      ? index
      : rawImage.order;

  if (
    !isAllowedListingImageSource(src) ||
    alt.length < MIN_IMAGE_ALT_LENGTH ||
    alt.length > MAX_IMAGE_ALT_LENGTH ||
    !Number.isInteger(order) ||
    order < 0
  ) {
    return null;
  }

  const width =
    Number.isInteger(rawImage.width) && rawImage.width > 0
      ? rawImage.width
      : null;
  const height =
    Number.isInteger(rawImage.height) && rawImage.height > 0
      ? rawImage.height
      : null;

  return {
    src,
    alt,
    order,
    isPrimary: rawImage.isPrimary === true,
    width,
    height,
    originalIndex: index,
  };
};

const normalizeListingImages = (images) => {
  const validImages = (Array.isArray(images) ? images : [])
    .map(normalizeLegacyImage)
    .filter(Boolean)
    .sort(
      (first, second) =>
        first.order - second.order ||
        first.originalIndex - second.originalIndex,
    );

  if (validImages.length === 0) {
    return {
      images: [],
      primaryImage: { ...FALLBACK_IMAGE },
    };
  }

  const explicitPrimaryIndex = validImages.findIndex(
    (image) => image.isPrimary,
  );
  const primaryIndex = explicitPrimaryIndex >= 0 ? explicitPrimaryIndex : 0;
  const normalizedImages = validImages.map(
    ({ originalIndex: _originalIndex, ...image }, index) => ({
      ...image,
      isPrimary: index === primaryIndex,
    }),
  );

  return {
    images: normalizedImages,
    primaryImage: {
      ...normalizedImages[primaryIndex],
      isFallback: false,
    },
  };
};

const toPlainListing = (listing) => {
  if (typeof listing?.toObject === "function") {
    return listing.toObject();
  }

  return isPlainObject(listing) ? { ...listing } : {};
};

const serializeListingImages = (listing) => {
  const listingObject = toPlainListing(listing);
  const {
    images: rawImages,
    primaryImage: _legacyPrimaryImage,
    ...existingFields
  } = listingObject;

  return {
    ...existingFields,
    ...normalizeListingImages(rawImages),
  };
};

module.exports = {
  FALLBACK_IMAGE,
  LISTING_FIELDS,
  LOCAL_IMAGE_SOURCE_PATTERN,
  MAX_IMAGE_ALT_LENGTH,
  MIN_IMAGE_ALT_LENGTH,
  isAllowedListingImageSource,
  normalizeListingImages,
  prepareListingImagesForStorage,
  serializeListingImages,
};
