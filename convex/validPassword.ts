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
        throw new Error(errorMessage);
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
        throw new Error(
          "Password must be at least 8 characters and include one uppercase letter, one lowercase letter, and one number."
        );
      }
    },
    ...options,
  });
}
