import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
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

export function PasswordReset() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"forgot" | { email: string }>("forgot");
  return step === "forgot" ? (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a verification code
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
            toast.error(getAuthErrorMessage(error));
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
            toast.error(getAuthErrorMessage(error));
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
