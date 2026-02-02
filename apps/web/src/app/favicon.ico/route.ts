import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-static";
export const revalidate = 31536000; // 1 year

export async function GET() {
  try {
    // Serve the icon.svg as favicon.ico
    // This handles the browser's automatic favicon.ico request
    const iconPath = join(process.cwd(), "public", "icon.svg");
    const iconContent = await readFile(iconPath);
    
    return new NextResponse(iconContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    // If icon.svg doesn't exist, return 204 No Content (no favicon)
    return new NextResponse(null, { status: 204 });
  }
}
