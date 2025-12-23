import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
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

export function SignIn() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signUp" | "signIn">("signIn");
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
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            toast.error(errorMessage);
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