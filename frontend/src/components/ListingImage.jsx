import {
  applyListingImageFallback,
  getPrimaryListingImage,
} from "../utils/listingImages";

const supportedVariants = new Set(["card", "detail", "thumbnail"]);

function ListingImage({
  listing,
  variant = "card",
  className = "",
  loading,
}) {
  const image = getPrimaryListingImage(listing);
  const safeVariant = supportedVariants.has(variant) ? variant : "card";
  const loadingStrategy =
    loading || (safeVariant === "detail" ? "eager" : "lazy");
  const classes = [
    "listing-image",
    `listing-image--${safeVariant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <img
        key={image.src}
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={loadingStrategy}
        decoding="async"
        onError={(event) => applyListingImageFallback(event.currentTarget)}
      />
    </div>
  );
}

export default ListingImage;
