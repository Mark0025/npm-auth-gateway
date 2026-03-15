import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="auth-gate">
      <h1>NPM Admin Panel</h1>
      <p>Sign in to access Nginx Proxy Manager</p>
      <SignIn routing="hash" />
    </div>
  );
}
