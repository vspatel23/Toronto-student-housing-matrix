import { useRef, useState } from "react";

function CollectionPickerModal({
  listingTitle,
  collections = [],
  isLoading = false,
  isSubmitting = false,
  onAddToCollections,
  onCreateAndAdd,
  onClose,
}) {
  const dialogRef = useRef(null);
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [newCollectionName, setNewCollectionName] = useState("");

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableControls = dialogRef.current?.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableControls?.length) {
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

  const toggleChecked = (collectionId) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (checkedIds.size === 0) {
      return;
    }
    onAddToCollections(Array.from(checkedIds));
  };

  const handleCreateAndAdd = () => {
    const name = newCollectionName.trim();
    if (!name) {
      return;
    }
    onCreateAndAdd(name);
    setNewCollectionName("");
  };

  return (
    <div className="app-modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="app-modal"
        role="dialog"
        aria-labelledby="collection-picker-title"
        aria-describedby="collection-picker-description"
        aria-modal="true"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="app-modal-header">
          <div>
            <h2 id="collection-picker-title">Add to Collection</h2>
            <p id="collection-picker-description">
              Choose one or more collections for "{listingTitle}".
            </p>
          </div>
          <button
            type="button"
            className="button button-small app-modal-close"
            autoFocus
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="app-modal-body">
          {isLoading && <p>Loading your collections…</p>}

          {!isLoading && collections.length === 0 && (
            <p>You don't have any collections yet. Create one below.</p>
          )}

          {!isLoading && collections.length > 0 && (
            <div className="collection-picker-list">
              {collections.map((collection) => (
                <label key={collection._id} className="collection-picker-option">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(collection._id)}
                    onChange={() => toggleChecked(collection._id)}
                  />
                  <span className="collection-picker-option-label">
                    <strong>{collection.name}</strong>
                    <small>
                      {collection.listingCount} listing
                      {collection.listingCount === 1 ? "" : "s"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="collection-picker-create">
            <span className="filter-group-label">Create a new collection</span>
            <div className="collection-picker-create-row">
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="Collection name"
                maxLength={80}
              />
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={!newCollectionName.trim() || isSubmitting}
                onClick={handleCreateAndAdd}
              >
                Create & Add
              </button>
            </div>
          </div>
        </div>

        <div className="app-modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={checkedIds.size === 0 || isSubmitting}
            onClick={handleAdd}
          >
            {isSubmitting
              ? "Adding…"
              : `Add to ${checkedIds.size} collection${
                  checkedIds.size === 1 ? "" : "s"
                }`}
          </button>
        </div>
      </section>
    </div>
  );
}

export default CollectionPickerModal;
