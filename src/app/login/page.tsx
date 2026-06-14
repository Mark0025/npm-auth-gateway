import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { getAuthProvider, getCurrentUser } from "@/lib/auth-provider";

export default async function LoginPage() {
  const provider = getAuthProvider();
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  if (provider === "oidc") {
    redirect("/api/oidc-login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-lg items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-xl shadow-black/25">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-400">
              Clerk
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              NPM Auth Gateway
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Sign in to access the dashboard, proxy hosts, and protected
              administration pages.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-3 text-left">
              <SignIn
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: "mx-auto w-full",
                    card: "w-full max-w-none border-0 bg-transparent shadow-none",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "rounded-xl",
                    formButtonPrimary:
                      "rounded-xl !bg-white !text-slate-950 hover:!bg-slate-200",
                    formFieldInput:
                      "rounded-xl !border-white/10 !bg-white/5 !text-white",
                    footerActionLink: "!text-cyan-300 hover:!text-cyan-200",
                  },
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
