const steps = [
  { number: 1, label: "⌕ Search", active: true },
  { number: 2, label: "☷ Browse Results", active: false },
  { number: 3, label: "▤ View Details", active: false },
  { number: 4, label: "⌘ Compare", active: false },
];

function StepProgress() {
  return (
    <nav className="step-nav" aria-label="Search progress">
      {steps.map((step, index) => (
        <span key={step.number}>
          {index > 0 && <span className="step-line"></span>}
          <div className={`step${step.active ? " active" : ""}`}>
            <span className="step-number">{step.number}</span>
            <span className="step-label">{step.label}</span>
          </div>
        </span>
      ))}
    </nav>
  );
}

export default StepProgress;
