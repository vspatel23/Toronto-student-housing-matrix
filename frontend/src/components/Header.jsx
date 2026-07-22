import BrandIdentity from "./BrandIdentity";

function Header({ currentView, userName, onLogout, onOpenSaved, onOpenSearch }) {
  const isSavedView = currentView === "saved";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <BrandIdentity compact />
        </div>

        <nav className="main-navigation" aria-label="Main navigation">
          <button
            type="button"
            className={`button button-nav${!isSavedView ? " active" : ""}`}
            aria-current={!isSavedView ? "page" : undefined}
            onClick={onOpenSearch}
          >
            Search
          </button>
          <button
            type="button"
            className={`button button-nav${isSavedView ? " active" : ""}`}
            aria-current={isSavedView ? "page" : undefined}
            onClick={onOpenSaved}
          >
            Saved Listings
          </button>
        </nav>

        <div className="header-account">
          <span className="header-user">
            <span className="header-user-label">Signed in as</span>
            <strong>{userName}</strong>
          </span>
          <button
            type="button"
            className="button button-danger-ghost"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
