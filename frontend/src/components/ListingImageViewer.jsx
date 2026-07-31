import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  clampListingImageIndex,
  getAdjacentListingImageIndex,
} from "../utils/listingImages";
import ListingImage from "./ListingImage";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const isTextEntryControl = (target) =>
  ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName) ||
  target?.isContentEditable === true;

function ListingImageViewer({
  images,
  currentIndex,
  onCurrentIndexChange,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const descriptionId = useId();
  const safeIndex = clampListingImageIndex(currentIndex, images.length);
  const currentImage = images[safeIndex];
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < images.length - 1;

  const showAdjacentImage = (direction) => {
    const nextIndex = getAdjacentListingImageIndex(
      safeIndex,
      direction,
      images.length,
    );

    if (nextIndex !== safeIndex) {
      onCurrentIndexChange(nextIndex);
    }
  };

  useLayoutEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const body = document.body;
    const appRoot = document.getElementById("root");
    const previousOverflow = body.style.overflow;
    const previousRootAriaHidden = appRoot?.getAttribute("aria-hidden");
    const rootWasInert = appRoot?.hasAttribute("inert") ?? false;

    body.style.overflow = "hidden";
    appRoot?.setAttribute("aria-hidden", "true");
    appRoot?.setAttribute("inert", "");

    return () => {
      body.style.overflow = previousOverflow;

      if (previousRootAriaHidden === null) {
        appRoot?.removeAttribute("aria-hidden");
      } else if (previousRootAriaHidden !== undefined) {
        appRoot?.setAttribute("aria-hidden", previousRootAriaHidden);
      }

      if (!rootWasInert) {
        appRoot?.removeAttribute("inert");
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (!isTextEntryControl(event.target) && event.key === "ArrowLeft") {
      event.preventDefault();
      showAdjacentImage(-1);
      return;
    }

    if (!isTextEntryControl(event.target) && event.key === "ArrowRight") {
      event.preventDefault();
      showAdjacentImage(1);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableControls =
      dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);

    if (!focusableControls?.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const firstControl = focusableControls[0];
    const lastControl = focusableControls[focusableControls.length - 1];

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  };

  const viewer = (
    <div
      className="listing-image-viewer__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <section
        ref={dialogRef}
        className="listing-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Listing image viewer"
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="listing-image-viewer__header">
          <div>
            <p className="listing-image-viewer__eyebrow">Full-size viewer</p>
            <p
              className="listing-image-viewer__counter"
              aria-live="polite"
              aria-atomic="true"
            >
              {safeIndex + 1} / {images.length}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="listing-image-viewer__close"
            aria-label="Close image viewer"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
            <span>Close</span>
          </button>
        </header>

        <p id={descriptionId} className="visually-hidden">
          {`Viewing image ${safeIndex + 1} of ${images.length}: ${
            currentImage.alt
          }. Use the left and right arrow keys to navigate.`}
        </p>

        <div className="listing-image-viewer__media">
          <button
            type="button"
            className="listing-image-viewer__nav listing-image-viewer__nav--previous"
            aria-label="Previous listing image"
            disabled={!canGoPrevious}
            onClick={() => showAdjacentImage(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>

          <ListingImage
            key={currentImage.id}
            image={currentImage}
            variant="viewer"
            className="listing-image-viewer__image"
            loading="eager"
          />

          <button
            type="button"
            className="listing-image-viewer__nav listing-image-viewer__nav--next"
            aria-label="Next listing image"
            disabled={!canGoNext}
            onClick={() => showAdjacentImage(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <p className="listing-image-viewer__caption">{currentImage.alt}</p>
      </section>
    </div>
  );

  return createPortal(viewer, document.body);
}

export default ListingImageViewer;
