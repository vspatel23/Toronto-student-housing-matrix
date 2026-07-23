import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import StatusMessage from "./StatusMessage";

function CreateCollectionForm({ onCreate, isSubmitting }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    onCreate({ name: trimmedName, description: description.trim() });
    setName("");
    setDescription("");
  };

  return (
    <form className="collections-create-form" onSubmit={handleSubmit}>
      <span className="filter-group-label">Create a new collection</span>
      <div className="collections-create-fields">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Collection name"
          maxLength={80}
          aria-label="New collection name"
        />
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional description"
          maxLength={300}
          aria-label="New collection description"
        />
        <button
          type="submit"
          className="button button-primary"
          disabled={!name.trim() || isSubmitting}
        >
          {isSubmitting ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}

function CollectionCard({
  collection,
  onOpen,
  onRename,
  onDelete,
  isPending,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editDescription, setEditDescription] = useState(
    collection.description || "",
  );

  const startEditing = (event) => {
    event.stopPropagation();
    setEditName(collection.name);
    setEditDescription(collection.description || "");
    setIsEditing(true);
  };

  const cancelEditing = (event) => {
    event.stopPropagation();
    setIsEditing(false);
  };

  const saveEditing = (event) => {
    event.stopPropagation();
    const trimmedName = editName.trim();
    if (!trimmedName) {
      return;
    }
    onRename(collection._id, {
      name: trimmedName,
      description: editDescription.trim(),
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="collection-card" role="group" aria-label="Edit collection">
        <input
          type="text"
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          maxLength={80}
          aria-label="Collection name"
        />
        <input
          type="text"
          value={editDescription}
          onChange={(event) => setEditDescription(event.target.value)}
          maxLength={300}
          placeholder="Optional description"
          aria-label="Collection description"
        />
        <div className="collection-card-actions">
          <button
            type="button"
            className="button button-primary button-small"
            disabled={!editName.trim() || isPending}
            onClick={saveEditing}
          >
            Save
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={cancelEditing}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <article
      className="collection-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(collection._id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(collection._id);
        }
      }}
    >
      <div className="collection-card-preview">
        {collection.previewTitle || "No listings yet"}
      </div>

      <div className="collection-card-title-row">
        <h3>{collection.name}</h3>
        <span className="collection-card-count">
          {collection.listingCount} listing
          {collection.listingCount === 1 ? "" : "s"}
        </span>
      </div>

      {collection.description && (
        <p className="collection-card-description">{collection.description}</p>
      )}

      <div className="collection-card-actions">
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={startEditing}
        >
          Rename
        </button>
        <button
          type="button"
          className="button button-danger-ghost button-small"
          disabled={isPending}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(collection._id);
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function Collections({
  collections,
  isLoading,
  errorMessage,
  actionStatus,
  onBack,
  onOpenCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  isCreating = false,
  pendingCollectionIds,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const hasCollections = collections.length > 0;
  const collectionPendingDelete = collections.find(
    (collection) => collection._id === confirmDeleteId,
  );

  return (
    <section className="collections-page" aria-labelledby="collections-title">
      <nav aria-label="Collections navigation">
        <button type="button" className="back-button" onClick={onBack}>
          Back to Saved Listings
        </button>
      </nav>

      <header className="saved-page-header">
        <div>
          <p className="section-eyebrow">Organize your shortlist</p>
          <h1 id="collections-title">Collections</h1>
          <p>
            Group saved listings by campus, budget, or decision stage.
          </p>
        </div>
      </header>

      {actionStatus?.message && (
        <StatusMessage type={actionStatus.type || "info"}>
          {actionStatus.message}
        </StatusMessage>
      )}

      <CreateCollectionForm
        onCreate={onCreateCollection}
        isSubmitting={isCreating}
      />

      {isLoading && (
        <div className="state-panel loading-state" role="status">
          <span className="spinner" aria-hidden="true"></span>
          <div>
            <h2>Loading Collections</h2>
            <p>Getting the collections saved to your account.</p>
          </div>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-panel error error-state" role="alert">
          <h2>Collections are temporarily unavailable</h2>
          <p>{errorMessage}</p>
        </div>
      )}

      {!isLoading && !errorMessage && !hasCollections && (
        <div className="state-panel empty-state">
          <h2>No collections yet</h2>
          <p>Create your first collection above to start organizing.</p>
        </div>
      )}

      {!isLoading && !errorMessage && hasCollections && (
        <div className="collections-grid">
          {collections.map((collection) => (
            <CollectionCard
              key={collection._id}
              collection={collection}
              onOpen={onOpenCollection}
              onRename={onRenameCollection}
              onDelete={setConfirmDeleteId}
              isPending={pendingCollectionIds?.has(collection._id)}
            />
          ))}
        </div>
      )}

      {collectionPendingDelete && (
        <ConfirmDialog
          title="Delete collection?"
          message={`"${collectionPendingDelete.name}" will be deleted. Its listings will stay in Saved Listings and any other collections -- nothing will be unsaved.`}
          confirmLabel="Delete collection"
          isConfirming={pendingCollectionIds?.has(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId("")}
          onConfirm={() => {
            onDeleteCollection(confirmDeleteId);
            setConfirmDeleteId("");
          }}
        />
      )}
    </section>
  );
}

export default Collections;
