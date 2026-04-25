import { signIn, signOut } from "@/auth";

export function SignInForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-ink-strong)]"
      >
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)] hover:bg-white"
      >
        Sign out
      </button>
    </form>
  );
}
