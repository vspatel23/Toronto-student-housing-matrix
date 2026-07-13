function ListingBadges({ badges }) {
  if (!badges || badges.length === 0) {
    return null;
  }

  return (
    <ul className="listing-badges" aria-label="Recommendation badges">
      {badges.slice(0, 3).map((badge) => (
        <li key={badge.label} className={`recommendation-badge ${badge.tone}`}>
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

export default ListingBadges;
