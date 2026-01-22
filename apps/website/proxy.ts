import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const botPaths = [
  /^\/wp-admin/i,
  /^\/wordpress/i,
  /^\/wp-content/i,
  /^\/wp-includes/i,
  /^\/wp-login/i,
  /^\/phpmyadmin/i,
  /^\/pma/i,
  /^\/adminer/i,
  /^\/administrator/i,
  /^\/.env$/i,
  /^\/config\.php$/i,
  /^\/setup-config\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/readme\.html$/i,
  /^\/license\.txt$/i,
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (botPaths.some((pattern) => pattern.test(pathname))) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)).*)",
  ],
};
