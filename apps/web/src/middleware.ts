import { NextResponse } from "next/server";

export default function middleware() {
  // Clerk has been removed; middleware is now a no-op.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
