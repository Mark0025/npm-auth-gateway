import Link from "next/link";

/**
 * Shown after a user signs out in OIDC mode.
 *
 * We deliberately do NOT redirect to /login here: /login immediately bounces
 * to the OIDC provider, and because the provider's SSO session is still active
 * the user would be silently signed straight back in — making "Sign out" look
 * broken. This static confirmation page keeps the user signed out of the gateway
 * while preserving the provider's SSO session (so other apps stay open and
 * re-login is one click). Local logout, not global — the expected default.
 */
export default function SignedOutPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-lg items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-xl shadow-black/25">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              You&apos;ve been signed out
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Your session on NPM Auth Gateway has ended. You can sign back in at
              any time.
            </p>
          </div>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-white px-5 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
            >
              Sign in again
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
