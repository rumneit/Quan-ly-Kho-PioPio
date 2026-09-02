import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = ["/login", "/setup", "/auth"].some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api");
  if (!user && !isPublic) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(url);
    // Copy cookies to redirect response
    request.cookies.getAll().forEach(({ name }) => {
      const cookie = response.cookies.get(name);
      if (cookie) redirectResponse.cookies.set(cookie);
    });
    redirectResponse.headers.set("Cache-Control", "no-store, must-revalidate");
    return redirectResponse;
  }
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
