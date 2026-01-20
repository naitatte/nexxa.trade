import { headers } from "next/headers"

export async function getRequestHeaders(): Promise<Headers> {
  const requestHeaders = await headers()
  return requestHeaders as unknown as Headers
}

export async function getRequestCookieHeader(): Promise<string | null> {
  const requestHeaders = await getRequestHeaders()
  return requestHeaders.get("cookie")
}
