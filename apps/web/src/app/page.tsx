import { redirect } from "next/navigation";
import { auth } from "@canopy-sight/auth";
import { cookies } from "next/headers";

export default async function Home() {
  let shouldRedirectToDashboard = false;

  try {
    const cookieStore = await cookies();
    const demoMode = cookieStore.get("demo_mode")?.value === "true";

    if (demoMode) {
      shouldRedirectToDashboard = true;
    } else {
      const { userId } = await auth();
      shouldRedirectToDashboard = !!userId;
    }
  } catch {
    shouldRedirectToDashboard = false;
  }

  redirect(shouldRedirectToDashboard ? "/dashboard" : "/sign-in");
}
