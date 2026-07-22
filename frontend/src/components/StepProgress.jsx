const stepConfig = [
  { key: "search", number: 1, label: "Search" },
  { key: "results", number: 2, label: "Browse Results" },
  { key: "details", number: 3, label: "View Details" },
  { key: "compare", number: 4, label: "Compare" },
];

const activeIndexByStep = {
  search: 0,
  results: 1,
  details: 2,
  compare: 3,
};

function StepProgress({ currentStep = "search" }) {
  const activeIndex = activeIndexByStep[currentStep] ?? 0;

  return (
    <nav className="step-nav" aria-label="Search progress">
      <ol className="step-list">
        {stepConfig.map((step, index) => (
          <li key={step.number}>
            <div
              className={`step${index === activeIndex ? " active" : ""}${
                index < activeIndex ? " completed" : ""
              }`}
              aria-current={index === activeIndex ? "step" : undefined}
            >
              <span className="step-number">{step.number}</span>
              <span className="step-label">{step.label}</span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default StepProgress;
