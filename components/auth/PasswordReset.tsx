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
    // Handle ConvexError
    if ("message" in error) {
      const message = String(error.message);
      
      // Handle password validation errors
      if (message.includes("Invalid password")) {
        return "Password must be at least 8 characters and contain at least one number, one lowercase letter, and one uppercase letter.";
      }
      
      // Handle email validation errors from zod
      if (message.includes("email") || message.includes("Email")) {
        if (message.includes("Invalid email")) {
          return "Please enter a valid email address.";
        }
        return "Email validation failed. Please check your email address.";
      }
      
      // Handle verification code errors
      if (message.includes("code") || message.includes("Code") || message.includes("verification")) {
        return "Invalid verification code. Please check and try again.";
      }
      
      // Return the error message as-is if it's a string
      return message;
    }
    
    // Handle error objects with data property (zod format errors)
    if ("data" in error && error.data) {
      try {
        const data = typeof error.data === "string" ? JSON.parse(error.data) : error.data;
        if (data.email) {
          const emailError = Array.isArray(data.email._errors) 
            ? data.email._errors[0] 
            : "Invalid email address.";
          return emailError;
        }
      } catch {
        // If parsing fails, fall through to default
      }
    }
  }
  
  return "An error occurred. Please try again.";
}

export function PasswordReset() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"forgot" | { email: string }>("forgot");
  return step === "forgot" ? (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a verification code
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await signIn("password", formData);
            setStep({ email: formData.get("email") as string });
            toast.success("Verification code sent! Check your email.");
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            toast.error(errorMessage);
          }
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="email"
              placeholder="name@example.com"
              type="email"
              required
            />
          </div>
          <Input name="flow" type="hidden" value="reset" />
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            Send Verification Code
          </Button>
        </CardFooter>
      </form>
    </Card>
  ) : (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verify Code</CardTitle>
        <CardDescription>
          Enter the verification code sent to {step.email} and your new password
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await signIn("password", formData);
            toast.success("Password reset successfully! You can now sign in with your new password.");
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            toast.error(errorMessage);
          }
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-code">Verification Code</Label>
            <Input
              id="reset-code"
              name="code"
              placeholder="Enter verification code"
              type="text"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              name="newPassword"
              placeholder="Enter new password"
              type="password"
              required
            />
          </div>
          <Input name="email" value={step.email} type="hidden" />
          <Input name="flow" value="reset-verification" type="hidden" />
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full">
            Reset Password
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep("forgot")}
            className="w-full"
          >
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}