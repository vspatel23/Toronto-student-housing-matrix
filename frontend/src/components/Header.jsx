function Header({ userName, onLogout, onOpenSaved }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="home-mark" aria-hidden="true">
          ⌂
        </div>
        <span>Toronto Student Housing Matrix</span>
      </div>
      <div className="topbar-actions">
        <p>Academic Decision-Support System</p>
        <div className="header-account">
          {onOpenSaved && (
            <button type="button" onClick={onOpenSaved}>
              ★ Saved Listings
            </button>
          )}
          <span>{userName}</span>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
