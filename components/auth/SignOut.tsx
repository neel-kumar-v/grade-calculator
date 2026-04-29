import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "../ui/button";
import { LogOut } from "lucide-react";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An error occurred while signing out. Please try again.";
}

export function SignOut({
  variant = "outline",
  className,
  onClick,
}: {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  className?: string;
  onClick?: () => void;
}) {
  const { signOut } = useAuthActions();
  return (
    <Button
      variant={variant}
      className={className}
      onClick={async () => {
        try {
          await signOut();
          toast.success("Signed out successfully");
          onClick?.();
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(errorMessage);
        }
      }}
    >
      <LogOut className="size-4" />
      Sign Out
    </Button>
  );
}