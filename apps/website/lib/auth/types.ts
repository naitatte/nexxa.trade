import type { authClient } from "./client";

export type AuthSession = ReturnType<(typeof authClient)["useSession"]>["data"];
export type AuthUser = NonNullable<AuthSession>["user"];
