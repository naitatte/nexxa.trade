/**
 * Error code translations to human-readable messages in English
 */

export type ErrorCode = string;

export interface ErrorTranslation {
  message: string;
  description?: string;
}

/**
 * Map of error codes to human-readable translations
 */
const ERROR_TRANSLATIONS: Record<ErrorCode, ErrorTranslation> = {
  // Authentication errors
  INVALID_EMAIL_OR_PASSWORD: {
    message: "Invalid email or password",
    description: "The email address or password you entered is incorrect. Please check your credentials and try again.",
  },
  EMAIL_ALREADY_EXISTS: {
    message: "Email already registered",
    description: "An account with this email address already exists. Please sign in or use a different email.",
  },
  INVALID_EMAIL: {
    message: "Invalid email address",
    description: "Please enter a valid email address.",
  },
  INVALID_PASSWORD: {
    message: "Invalid password",
    description: "The password does not meet the requirements. Please check and try again.",
  },
  PASSWORD_TOO_SHORT: {
    message: "Password too short",
    description: "Password must be at least 8 characters long.",
  },
  PASSWORD_TOO_WEAK: {
    message: "Password too weak",
    description: "Please choose a stronger password with a mix of letters, numbers, and special characters.",
  },
  PASSWORDS_DO_NOT_MATCH: {
    message: "Passwords do not match",
    description: "The passwords you entered do not match. Please try again.",
  },

  // Token errors
  INVALID_TOKEN: {
    message: "Invalid token",
    description: "The authentication token is invalid or has been revoked.",
  },
  TOKEN_EXPIRED: {
    message: "Token expired",
    description: "Your session has expired. Please sign in again.",
  },
  TOKEN_NOT_FOUND: {
    message: "Token not found",
    description: "The requested token could not be found.",
  },

  // Authorization errors
  UNAUTHORIZED: {
    message: "Unauthorized",
    description: "You are not authorized to perform this action. Please sign in.",
  },
  FORBIDDEN: {
    message: "Access forbidden",
    description: "You do not have permission to access this resource.",
  },
  SESSION_EXPIRED: {
    message: "Session expired",
    description: "Your session has expired. Please sign in again.",
  },
  SESSION_INVALID: {
    message: "Invalid session",
    description: "Your session is invalid. Please sign in again.",
  },

  // User errors
  USER_NOT_FOUND: {
    message: "User not found",
    description: "The requested user could not be found.",
  },
  USER_ALREADY_EXISTS: {
    message: "User already exists",
    description: "A user with this information already exists.",
  },
  EMAIL_NOT_VERIFIED: {
    message: "Email not verified",
    description: "Please verify your email address before continuing.",
  },
  INVALID_USERNAME_OR_PASSWORD: {
    message: "Invalid username or password",
    description: "The username or password you entered is incorrect. Please try again.",
  },
  USERNAME_IS_ALREADY_TAKEN: {
    message: "Username already taken",
    description: "That username is already in use. Please choose another.",
  },
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: {
    message: "Username already taken",
    description: "That username is already in use. Please choose another.",
  },
  USERNAME_TOO_SHORT: {
    message: "Username too short",
    description: "Username must be at least 3 characters long.",
  },
  USERNAME_TOO_LONG: {
    message: "Username too long",
    description: "Username must be 30 characters or less.",
  },
  INVALID_USERNAME: {
    message: "Invalid username",
    description: "Usernames can only use letters, numbers, underscores, and dots.",
  },

  // Request errors
  INVALID_REQUEST: {
    message: "Invalid request",
    description: "The request is invalid. Please check your input and try again.",
  },
  MISSING_REQUIRED_FIELD: {
    message: "Missing required field",
    description: "Please fill in all required fields.",
  },
  INVALID_INPUT: {
    message: "Invalid input",
    description: "The provided input is invalid. Please check and try again.",
  },

  // Server errors
  INTERNAL_SERVER_ERROR: {
    message: "Internal server error",
    description: "An unexpected error occurred. Please try again later.",
  },
  SERVICE_UNAVAILABLE: {
    message: "Service unavailable",
    description: "The service is temporarily unavailable. Please try again later.",
  },
  RATE_LIMIT_EXCEEDED: {
    message: "Too many requests",
    description: "You have made too many requests. Please wait a moment and try again.",
  },

  // Network errors
  NETWORK_ERROR: {
    message: "Network error",
    description: "Unable to connect to the server. Please check your internet connection.",
  },
  TIMEOUT: {
    message: "Request timeout",
    description: "The request took too long to complete. Please try again.",
  },
  CONNECTION_ERROR: {
    message: "Connection error",
    description: "Unable to establish a connection. Please check your network settings.",
  },

  // Password reset errors
  RESET_TOKEN_INVALID: {
    message: "Invalid reset token",
    description: "The password reset link is invalid or has expired. Please request a new one.",
  },
  RESET_TOKEN_EXPIRED: {
    message: "Reset token expired",
    description: "The password reset link has expired. Please request a new one.",
  },
  PASSWORD_RESET_FAILED: {
    message: "Password reset failed",
    description: "Unable to reset your password. Please try again.",
  },

  // Email errors
  EMAIL_SEND_FAILED: {
    message: "Failed to send email",
    description: "Unable to send the email. Please try again later.",
  },
  EMAIL_VERIFICATION_FAILED: {
    message: "Email verification failed",
    description: "Unable to verify your email address. Please try again.",
  },
};

/**
 * Translates an error code to a human-readable message
 * @param code - The error code to translate
 * @param fallback - Optional fallback message if code is not found
 * @returns The translated error message and description
 */
export function translateError(
  code: ErrorCode | undefined | null,
  fallback?: string
): ErrorTranslation {
  if (!code) {
    return {
      message: fallback || "An error occurred",
      description: "Please try again or contact support if the problem persists.",
    };
  }

  const translation = ERROR_TRANSLATIONS[code];
  if (translation) {
    return translation;
  }

  // If code is not found, try to format it nicely
  const formattedCode = code
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

  return {
    message: fallback || formattedCode || "An error occurred",
    description: "Please try again or contact support if the problem persists.",
  };
}

/**
 * Gets only the error message (without description)
 * @param code - The error code to translate
 * @param fallback - Optional fallback message if code is not found
 * @returns The translated error message
 */
export function getErrorMessage(
  code: ErrorCode | undefined | null,
  fallback?: string
): string {
  return translateError(code, fallback).message;
}

/**
 * Gets the error description (if available)
 * @param code - The error code to translate
 * @returns The error description or undefined
 */
export function getErrorDescription(
  code: ErrorCode | undefined | null
): string | undefined {
  return translateError(code).description;
}

/**
 * Extracts error code from various error formats
 * @param error - The error object, string, or response
 * @returns The error code if found
 */
export function extractErrorCode(error: unknown): ErrorCode | null {
  if (!error) return null;

  // If error is a string, try to parse it as JSON
  if (typeof error === "string") {
    // Handle format: "API Error: 401 {...json...}"
    const apiErrorMatch = error.match(/API Error: \d+ (.+)/);
    if (apiErrorMatch) {
      try {
        const parsed = JSON.parse(apiErrorMatch[1]);
        return parsed.code || parsed.error?.code || null;
      } catch {
        // If parsing fails, try to extract code from the string
        const codeMatch = error.match(/"code"\s*:\s*"([^"]+)"/);
        if (codeMatch) {
          return codeMatch[1];
        }
      }
    }
    
    // Try to parse the whole string as JSON
    try {
      const parsed = JSON.parse(error);
      return parsed.code || parsed.error?.code || null;
    } catch {
      // Try to extract code from string pattern
      const codeMatch = error.match(/"code"\s*:\s*"([^"]+)"/);
      if (codeMatch) {
        return codeMatch[1];
      }
    }
  }

  // If error is an object with a code property
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;
    
    // Check for code directly
    if (typeof errorObj.code === "string") {
      return errorObj.code;
    }

    // Check nested error.code
    if (errorObj.error && typeof errorObj.error === "object") {
      const nestedError = errorObj.error as Record<string, unknown>;
      if (typeof nestedError.code === "string") {
        return nestedError.code;
      }
    }

    // Check for response.data.code (common in API responses)
    if (errorObj.response && typeof errorObj.response === "object") {
      const response = errorObj.response as Record<string, unknown>;
      if (response.data && typeof response.data === "object") {
        const data = response.data as Record<string, unknown>;
        if (typeof data.code === "string") {
          return data.code;
        }
      }
    }
  }

  return null;
}

/**
 * Translates an error object to a human-readable message
 * Handles various error formats including API responses
 * @param error - The error to translate
 * @param fallback - Optional fallback message
 * @returns The translated error message and description
 */
export function translateErrorFromResponse(
  error: unknown,
  fallback?: string
): ErrorTranslation {
  const code = extractErrorCode(error);
  
  // If we have a code, use it
  if (code) {
    return translateError(code, fallback);
  }

  // Otherwise, try to extract message from error
  let message = fallback || "An error occurred";
  let description: string | undefined;
  
  if (typeof error === "string") {
    // Try to parse JSON from error string (e.g., "API Error: 401 {...json...}")
    const apiErrorMatch = error.match(/API Error: \d+ (.+)/);
    if (apiErrorMatch) {
      try {
        const parsed = JSON.parse(apiErrorMatch[1]);
        if (parsed.code) {
          return translateError(parsed.code, parsed.message || fallback);
        }
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        // If parsing fails, use the original error string
        message = error;
      }
    } else {
      message = error;
    }
  } else if (error instanceof Error) {
    // Try to parse JSON from error message
    const apiErrorMatch = error.message.match(/API Error: \d+ (.+)/);
    if (apiErrorMatch) {
      try {
        const parsed = JSON.parse(apiErrorMatch[1]);
        if (parsed.code) {
          return translateError(parsed.code, parsed.message || fallback);
        }
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        message = error.message;
      }
    } else {
      message = error.message;
    }
  } else if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;
    
    // Try to get code first
    if (typeof errorObj.code === "string") {
      return translateError(errorObj.code, typeof errorObj.message === "string" ? errorObj.message : fallback);
    }
    
    // Try to get message from various locations
    if (typeof errorObj.message === "string") {
      message = errorObj.message;
    } else if (errorObj.error && typeof errorObj.error === "object") {
      const nestedError = errorObj.error as Record<string, unknown>;
      if (typeof nestedError.code === "string") {
        return translateError(nestedError.code, typeof nestedError.message === "string" ? nestedError.message : fallback);
      }
      if (typeof nestedError.message === "string") {
        message = nestedError.message;
      }
    } else if (errorObj.response && typeof errorObj.response === "object") {
      const response = errorObj.response as Record<string, unknown>;
      if (response.data && typeof response.data === "object") {
        const data = response.data as Record<string, unknown>;
        if (typeof data.code === "string") {
          return translateError(data.code, typeof data.message === "string" ? data.message : fallback);
        }
        if (typeof data.message === "string") {
          message = data.message;
        }
      }
    }
  }

  return {
    message,
    description,
  };
}
