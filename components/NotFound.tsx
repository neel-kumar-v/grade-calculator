"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex flex-col container max-w-2xl  mx-auto items-center justify-center py-16 gap-6">
      <AlertCircle className="size-16 text-muted-foreground" />
      <h2 className="text-3xl font-semibold">Page Not Found</h2>
      <p className="text-muted-foreground text-center max-w-md">
        The grading period you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to access it.
      </p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}

