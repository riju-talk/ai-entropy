/** Plain-language explanations for NextAuth `?error=` codes (plus our own DatabaseUnavailable). */
const MESSAGES: Record<string, string> = {
  Configuration: "Sign-in is not set up correctly on this server. If you run this app, check the auth environment variables.",
  AccessDenied: "You do not have access, or the sign-in was cancelled.",
  Verification: "That sign-in link is no longer valid. Request a new one.",
  OAuthSignin: "Could not start sign-in with that provider. Try again.",
  OAuthCallback: "The provider returned an error while signing you in. Try again.",
  OAuthCreateAccount: "We could not create your account from that provider. Try another sign-in method.",
  OAuthAccountNotLinked: "That email already belongs to an account created with a different provider. Sign in with the original one.",
  SessionRequired: "Please sign in to continue.",
  CredentialsSignin: "Those details did not match a demo account.",
  DatabaseUnavailable: "The database is unavailable right now, so we could not sign you in. Try again shortly.",
  Default: "Something went wrong while signing in. Please try again.",
}

export function authErrorMessage(code?: string | null): string {
  return (code && MESSAGES[code]) || MESSAGES.Default
}
