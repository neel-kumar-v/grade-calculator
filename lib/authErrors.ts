export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message);

    if (message.includes("Invalid password") || message.includes("Password must be at least")) {
      return "Password must be at least 8 characters and include one uppercase letter, one lowercase letter, and one number.";
    }
    if (message.includes("InvalidAccountId")) {
      return "We could not complete sign in. Please try again. If this keeps happening, reset your password.";
    }
    if (message.includes("Invalid email")) {
      return "Please enter a valid email address.";
    }
    if (message.includes("email") || message.includes("Email")) {
      return "Please check your email address and try again.";
    }
    if (message.includes("verification") || message.includes("Invalid code") || message.includes("code")) {
      return "Invalid verification code. Please check and try again.";
    }
    return message;
  }

  if (error && typeof error === "object" && "data" in error && (error as { data?: unknown }).data) {
    try {
      const rawData = (error as { data: unknown }).data;
      const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      if (data && typeof data === "object" && "email" in data) {
        return "Please enter a valid email address.";
      }
    } catch {
      // Fall through to default message.
    }
  }

  return "Something went wrong. Please try again.";
}
