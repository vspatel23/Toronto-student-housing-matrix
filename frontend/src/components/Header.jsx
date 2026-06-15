function Header({ userName, onLogout }) {
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
