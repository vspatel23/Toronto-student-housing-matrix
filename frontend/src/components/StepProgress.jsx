const stepConfig = [
  { key: "search", number: 1, label: "⌕ Search" },
  { key: "results", number: 2, label: "☷ Browse Results" },
  { key: "details", number: 3, label: "▤ View Details" },
  { key: "compare", number: 4, label: "⌘ Compare" },
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
      {stepConfig.map((step, index) => (
        <span key={step.number}>
          {index > 0 && <span className="step-line"></span>}
          <div
            className={`step${index === activeIndex ? " active" : ""}${
              index < activeIndex ? " completed" : ""
            }`}
          >
            <span className="step-number">{step.number}</span>
            <span className="step-label">{step.label}</span>
          </div>
        </span>
      ))}
    </nav>
  );
}

export default StepProgress;
