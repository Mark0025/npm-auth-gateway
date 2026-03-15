"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser } from "@/actions/user-actions";

/** Form to invite a new user by email via Clerk, with success/error feedback */
export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit() {
    if (!email.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await inviteUser(email.trim());
        setSuccess(`Created ${email.trim()} — assign access lists on their detail page`);
        setEmail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create user");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4">
      <p className="text-sm font-medium">Invite User</p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="jon@peterei.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={isPending}
          className="max-w-xs"
        />
        <Button onClick={handleSubmit} disabled={isPending || !email.trim()}>
          {isPending ? "Creating..." : "Create User"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-green-500">{success}</p>}
    </div>
  );
}
