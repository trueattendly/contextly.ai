/**
 * Canonical URL resolver for Supabase Auth and redirects.
 * Resolves the active site URL dynamically with priority:
 * 1. NEXT_PUBLIC_SITE_URL
 * 2. NEXT_PUBLIC_APP_URL
 * 3. NEXT_PUBLIC_VERCEL_URL
 * 4. Client-side window.location.origin (if available)
 * 5. Localhost fallback
 */
export const getURL = (): string => {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    (typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:3000/");

  url = url.includes("http") ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === "/" ? url : `${url}/`;
  return url;
};

