import { auth } from "@/auth";
import { getAppUserByEmail } from "@/db/queries";

export async function getCurrentAppUser() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return getAppUserByEmail(email);
}
