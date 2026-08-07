import { useId, useState } from "react";

function CollapsiblePanel({
  title,
  subtitle,
  headerExtra,
  defaultExpanded = false,
  className = "",
  children,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const generatedId = useId();
  const headerId = `${generatedId}-header`;
  const contentId = `${generatedId}-content`;

  return (
    <div
      className={`collapsible-panel${isExpanded ? " is-expanded" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="collapsible-panel-header">
        <button
          type="button"
          id={headerId}
          className="collapsible-panel-toggle"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span className="collapsible-panel-toggle-icon" aria-hidden="true">
            {isExpanded ? "−" : "+"}
          </span>
          <span className="collapsible-panel-titles">
            <span className="collapsible-panel-title">{title}</span>
            {subtitle && (
              <span className="collapsible-panel-subtitle">{subtitle}</span>
            )}
          </span>
        </button>
        {headerExtra && (
          <div className="collapsible-panel-header-extra">{headerExtra}</div>
        )}
      </div>

      {isExpanded && (
        <div
          className="collapsible-panel-content"
          id={contentId}
          role="region"
          aria-labelledby={headerId}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsiblePanel;
