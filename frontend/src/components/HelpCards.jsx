import { helpCards } from "../utils/constants";

function HelpIcon({ name }) {
  if (name === "commute") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }

  if (name === "safety") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 5.5 5.5v5.2c0 4.1 2.6 7.8 6.5 9.3 3.9-1.5 6.5-5.2 6.5-9.3V5.5L12 3Z" />
        <path d="m9.2 11.8 1.8 1.8 3.9-4" />
      </svg>
    );
  }

  if (name === "browse") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="4" rx="1" />
        <rect x="4" y="11" width="16" height="4" rx="1" />
        <rect x="4" y="17" width="10" height="2" rx="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.5h9l3 3V13" />
      <path d="M15 3.5V7h3" />
      <path d="M14 20.5H6V3.5" />
      <circle cx="16.5" cy="16.5" r="3" />
      <path d="m18.7 18.7 2 2" />
    </svg>
  );
}

function HelpCards() {
  return (
    <section className="help-section" aria-labelledby="help-title">
      <h2 id="help-title">How We Help You Decide</h2>
      <div className="help-grid">
        {helpCards.map((card) => (
          <article className="help-card" key={card.title}>
            <span
              className={`help-card-icon help-card-icon-${card.tone}`}
              aria-hidden="true"
            >
              <HelpIcon name={card.icon} />
            </span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HelpCards;
