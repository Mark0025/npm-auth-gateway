"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteHost } from "@/actions/npm-actions";
import { useRouter } from "next/navigation";

/** Destructive button with confirmation dialog to permanently delete a proxy host from NPM */
export function DeleteHostButton({
  id,
  domain,
}: {
  id: number;
  domain: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? "Deleting..." : "Delete Host"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {domain}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the proxy host from NPM. The domain
            will stop working immediately. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                await deleteHost(id);
                router.push("/proxy-hosts");
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
