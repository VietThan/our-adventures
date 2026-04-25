export const authErrorMessages = {
  "not-allowed": "This account is not allowed for our-adventures.",
  "google-conflict":
    "This email is already linked to a different Google account.",
} as const;

export type AuthErrorCode = keyof typeof authErrorMessages;

export function getAuthErrorMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value in authErrorMessages) {
    return authErrorMessages[value as AuthErrorCode];
  }

  return "Sign-in failed. Please try again.";
}
