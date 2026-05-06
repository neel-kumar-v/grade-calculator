import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { getAuthErrorMessage } from "@/lib/authErrors";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface SignInProps {
  initialStep?: "signIn" | "signUp";
}

export function SignIn({ initialStep = "signIn" }: SignInProps) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<"signUp" | "signIn">(initialStep);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const settings = useQuery(api.settings.get);

  // Handle redirect after successful signup
  useEffect(() => {
    if (justSignedUp && settings !== undefined) {
      // User just signed up and is now authenticated (settings loaded means authenticated)
      // Settings can be null for new users, but undefined means not loaded yet
      sessionStorage.setItem("startTemplateTour", "true");
      sessionStorage.setItem("isNewUser", "true");
      setJustSignedUp(false);
      // Redirect to home page
      setTimeout(() => {
        router.push("/");
      }, 500);
    }
  }, [justSignedUp, settings, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">{step === "signIn" ? "Sign In" : "Sign Up"}</CardTitle>
        {step === "signUp" && (
          <CardDescription className="text-center">
            Create a new account to get started
          </CardDescription>
        )}
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await signIn("password", formData);
            if (step === "signUp") {
              setJustSignedUp(true);
            }
          } catch (error) {
            toast.error(getAuthErrorMessage(error));
          }
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              placeholder="name@example.com"
              type="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              placeholder="Enter your password"
              type="password"
              required
            />
          </div>
          <Input name="flow" type="hidden" value={step} />
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full">
            {step === "signIn" ? "Sign In" : "Sign Up"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep(step === "signIn" ? "signUp" : "signIn");
            }}
            className="w-full"
          >
            {step === "signIn"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
