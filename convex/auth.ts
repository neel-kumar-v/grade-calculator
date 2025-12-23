import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTPPasswordReset } from "./resetPassword";
import createPasswordProvider from "./validPassword";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createPasswordProvider({ reset: ResendOTPPasswordReset })],
});
