import { redirect } from "next/navigation";
import { auth } from "@canopy-sight/auth";
import { cookies } from "next/headers";

export default async function Home() {
  try {
    // Check for demo mode
    const cookieStore = await cookies();
    const demoMode = cookieStore.get("demo_mode")?.value === "true";

    if (demoMode) {
      redirect("/dashboard");
    }

    const { userId } = await auth();

    if (!userId) {
      redirect("/sign-in");
    }

    redirect("/dashboard");
  } catch (error) {
    // If auth check fails, redirect to sign-in
    // Error is expected in demo mode when auth is not configured
    redirect("/sign-in");
  }
}
