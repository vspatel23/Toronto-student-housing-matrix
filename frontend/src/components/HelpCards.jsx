import { helpCards } from "../utils/constants";

function HelpCards() {
  return (
    <section className="help-section" aria-labelledby="help-title">
      <h2 id="help-title">How We Help You Decide</h2>
      <div className="help-grid">
        {helpCards.map((card) => (
          <article className="help-card" key={card.title}>
            <div className={`help-icon ${card.tone}`}>{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HelpCards;
