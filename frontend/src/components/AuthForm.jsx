import StatusMessage from "./StatusMessage";
import BrandIdentity from "./BrandIdentity";

function AuthForm({
  authMode,
  authForm,
  authStatus,
  isSubmitting,
  onFieldChange,
  onModeChange,
  onSubmit,
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <BrandIdentity />
        </div>

        <div className="auth-heading">
          <h1 id="auth-title">
            {authMode === "register" ? "Create Account" : "Log In"}
          </h1>
          <p>
            {authMode === "register"
              ? "Create your account to compare housing options with confidence."
              : "Welcome back. Log in to continue your housing search."}
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {authMode === "register" && (
            <label htmlFor="auth-name">
              <span>Name</span>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                required
                value={authForm.name}
                aria-describedby={
                  authStatus.type === "error" ? "auth-status" : undefined
                }
                onChange={(event) =>
                  onFieldChange("name", event.target.value)
                }
              />
            </label>
          )}

          <label htmlFor="auth-email">
            <span>Email</span>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={authForm.email}
              aria-describedby={
                authStatus.type === "error"
                  ? "auth-email-help auth-status"
                  : "auth-email-help"
              }
              onChange={(event) =>
                onFieldChange("email", event.target.value)
              }
            />
            <small className="field-helper" id="auth-email-help">
              Use a valid email address.
            </small>
          </label>

          <label htmlFor="auth-password">
            <span>Password</span>
            <input
              id="auth-password"
              type="password"
              autoComplete={
                authMode === "register" ? "new-password" : "current-password"
              }
              required
              minLength="6"
              value={authForm.password}
              aria-describedby={
                authStatus.type === "error"
                  ? "auth-password-help auth-status"
                  : "auth-password-help"
              }
              onChange={(event) =>
                onFieldChange("password", event.target.value)
              }
            />
            <small className="field-helper" id="auth-password-help">
              At least 6 characters.
            </small>
          </label>

          {authStatus.message && (
            <StatusMessage
              id="auth-status"
              type={authStatus.type || "info"}
            >
              {authStatus.message}
            </StatusMessage>
          )}

          <button
            className="button button-primary auth-submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? authMode === "register"
                ? "Creating account…"
                : "Logging in…"
              : authMode === "register"
                ? "Create Account"
                : "Log In"}
          </button>
        </form>

        <p className="auth-switch">
          {authMode === "register"
            ? "Already have an account?"
            : "Need an account?"}
          <button
            type="button"
            onClick={() =>
              onModeChange(authMode === "register" ? "login" : "register")
            }
          >
            {authMode === "register" ? "Log In" : "Register"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default AuthForm;
