function BrandIdentity({ compact = false }) {
  return (
    <span className={`brand-identity${compact ? " compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        TS
      </span>
      <span className="brand-copy">
        <strong>Toronto Student Housing Matrix</strong>
        <small>Student housing decision support</small>
      </span>
    </span>
  );
}

export default BrandIdentity;
