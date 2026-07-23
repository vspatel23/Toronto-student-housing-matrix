import { useState } from "react";

function CopyLinkButton({ label = "Copy Link", className = "" }) {
  const [status, setStatus] = useState("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copied.");
    } catch {
      setStatus("Couldn't copy the link. Please copy it from the address bar.");
    }

    window.setTimeout(() => setStatus(""), 3500);
  };

  return (
    <span className="copy-link-control">
      <button
        type="button"
        className={`button button-secondary${className ? ` ${className}` : ""}`}
        onClick={handleCopy}
      >
        {label}
      </button>
      <span className="copy-link-status" role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}

export default CopyLinkButton;
