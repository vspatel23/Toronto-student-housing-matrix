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
          <div className="home-mark" aria-hidden="true">
            ⌂
          </div>
          <span>Toronto Student Housing Matrix</span>
        </div>

        <div className="auth-heading">
          <h1 id="auth-title">
            {authMode === "register" ? "Create Account" : "Log In"}
          </h1>
          <p>
            {authMode === "register"
              ? "Create an account to continue to the housing dashboard."
              : "Log in to continue to the housing dashboard."}
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {authMode === "register" && (
            <label>
              <span>Name</span>
              <input
                type="text"
                autoComplete="name"
                value={authForm.name}
                onChange={(event) =>
                  onFieldChange("name", event.target.value)
                }
              />
            </label>
          )}

          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={authForm.email}
              onChange={(event) =>
                onFieldChange("email", event.target.value)
              }
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete={
                authMode === "register" ? "new-password" : "current-password"
              }
              value={authForm.password}
              onChange={(event) =>
                onFieldChange("password", event.target.value)
              }
            />
          </label>

          {authStatus.message && (
            <div className={`status-message ${authStatus.type}`} role="status">
              {authStatus.message}
            </div>
          )}

          <button
            className="auth-submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Submitting..."
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
