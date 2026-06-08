import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Geist } from "next/font/google";
import { getAuthProvider } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "NPM Auth Gateway",
  description: "Clerk-authenticated gateway for Nginx Proxy Manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authProvider = getAuthProvider();

  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className="antialiased">
        {authProvider === "clerk" ? (
          <ClerkProvider appearance={{ baseTheme: dark }}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
