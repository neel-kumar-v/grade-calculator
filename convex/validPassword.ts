import { ConvexError } from "convex/values";
import { Password } from "@convex-dev/auth/providers/Password";
import { z } from "zod";

const ParamsSchema = z.object({
  email: z.string().email(),
});

export default function createPasswordProvider(
  options?: Parameters<typeof Password>[0]
) {
  return Password({
    profile(params) {
      const { error, data } = ParamsSchema.safeParse(params);
      if (error) {
        const errorMessage = error.issues
          .map((issue) => {
            if (issue.path.length > 0) {
              return `${issue.path.join(".")}: ${issue.message}`;
            }
            return issue.message;
          })
          .join(", ");
        throw new ConvexError(errorMessage);
      }
      return { email: data.email };
    },
    validatePasswordRequirements: (password: string) => {
      if (
        password.length < 8 ||
        !/\d/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password)
      ) {
        throw new ConvexError("Invalid password.");
      }
    },
    ...options,
  });
}