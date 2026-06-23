export default function AuthScreens() {
  return (
    <section id="lockScreen" className="auth-screen" aria-labelledby="lockTitle">
      <form id="lockForm" className="auth-card">
        <p className="eyebrow">Private finance workspace</p>
        <h1 id="lockTitle">Student Finance</h1>
        <p id="lockHint">Login with Gmail and password. New users can create an account.</p>
        <label htmlFor="loginEmailInput">
          <span>Gmail</span>
          <input id="loginEmailInput" type="email" placeholder="name@gmail.com" autoComplete="username" required />
        </label>
        <label htmlFor="passwordInput">
          <span>Password</span>
          <input id="passwordInput" type="password" minLength="4" autoComplete="current-password" required />
        </label>
        <button id="lockSubmit" type="submit">Login</button>
        <button id="createAccountBtn" className="secondary-button" type="button">Create account</button>
        <button id="forgotBtn" className="text-button" type="button">Forgot password?</button>
        <p id="lockStatus" className="status-text" aria-live="polite" />
      </form>

      <form id="recoveryForm" className="auth-card" hidden>
        <p className="eyebrow">Gmail recovery</p>
        <h1>Reset password</h1>
        <p id="recoveryHint">Request a reset code for your registered Gmail.</p>
        <label htmlFor="recoveryEmailInput">
          <span>Connected Gmail</span>
          <input id="recoveryEmailInput" type="email" placeholder="name@gmail.com" required />
        </label>
        <button id="sendCodeBtn" type="button">Send reset code</button>
        <label htmlFor="recoveryCodeInput">
          <span>Code</span>
          <input id="recoveryCodeInput" type="text" inputMode="numeric" maxLength="6" autoComplete="one-time-code" required />
        </label>
        <label htmlFor="newPasswordInput">
          <span>New password</span>
          <input id="newPasswordInput" type="password" minLength="4" autoComplete="new-password" required />
        </label>
        <button type="submit">Reset password</button>
        <button id="backToLoginBtn" className="secondary-button" type="button">Back to login</button>
        <p id="recoveryStatus" className="status-text" aria-live="polite" />
      </form>
    </section>
  );
}
