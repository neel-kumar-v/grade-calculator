import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "../ui/button";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An error occurred while signing out. Please try again.";
}

export function SignOut({
  variant = "outline",
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { signOut } = useAuthActions();
  return (
    <Button
      variant={variant}
      onClick={async () => {
        try {
          await signOut();
          toast.success("Signed out successfully");
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(errorMessage);
        }
      }}
    >
      Sign Out
    </Button>
  );
}