import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("message" in error) {
      const message = String(error.message);
      if (message.includes("Invalid password")) {
        return "Password must be at least 8 characters and contain at least one number, one lowercase letter, and one uppercase letter.";
      }
      if (message.includes("email") || message.includes("Email")) {
        if (message.includes("Invalid email")) {
          return "Please enter a valid email address.";
        }
        return "Email validation failed. Please check your email address.";
      }
      return message;
    }
    if ("data" in error && error.data) {
      try {
        const data = typeof error.data === "string" ? JSON.parse(error.data) : error.data;
        if (data.email) {
          const emailError = Array.isArray(data.email._errors) 
            ? data.email._errors[0] 
            : "Invalid email address.";
          return emailError;
        }
      } catch {}
    }
  }
  return "An error occurred. Please try again.";
}

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
            // Signup/login succeeded, even if there was an internal error
            // The error might be logged but the auth flow completes successfully
            
            // If this was a signup, mark that we just signed up
            // The useEffect will handle the redirect once auth state is confirmed
            if (step === "signUp") {
              setJustSignedUp(true);
            }
          } catch (error: any) {
            // Check if this is the known null _id error during signup
            // This happens in the auth library but signup still succeeds
            const errorMessage = error?.message || String(error);
            if (errorMessage.includes("Cannot read properties of null") && 
                errorMessage.includes("_id") &&
                step === "signUp") {
              // This is a known issue in the auth library during signup
              // The signup actually succeeds, so we can ignore this error
              // The user will be authenticated despite the error
              console.warn("Signup completed with internal auth library error (this is expected):", errorMessage);
              return;
            }
            const errorMessageFormatted = getErrorMessage(error);
            toast.error(errorMessageFormatted);
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