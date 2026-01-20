export function parseUserAgent(userAgent?: string | null): {
  browser: string
  device: string
} {
  if (!userAgent) {
    return { browser: "Unknown", device: "Unknown" }
  }

  const ua = userAgent.toLowerCase()

  let browser = "Unknown"
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browser = "Chrome"
  } else if (ua.includes("firefox")) {
    browser = "Firefox"
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari"
  } else if (ua.includes("edg")) {
    browser = "Edge"
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera"
  } else if (ua.includes("brave")) {
    browser = "Brave"
  }

  let device = "Desktop"
  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipod")
  ) {
    device = "Mobile"
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    device = "Tablet"
  }

  return { browser, device }
}

export function getLocationFromIp(ipAddress?: string | null): string {
  if (!ipAddress) {
    return "Unknown"
  }

  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return "Localhost"
  }

  return ipAddress
}
