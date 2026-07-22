function StatusMessage({ type = "info", children, className = "", id }) {
  const isError = type === "error" || type === "validation";
  const role = isError ? "alert" : "status";

  return (
    <div
      className={`status-message ${type}${className ? ` ${className}` : ""}`}
      id={id}
      role={role}
      aria-live={isError ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

export default StatusMessage;
