import type { UserRole as Role } from "@nexxatrade/core";
export type { UserRole } from "@nexxatrade/core";

export type UserStatus = "active" | "inactive";
export type MembershipState = "active" | "inactive" | "deleted";

export type MenuItem = {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  isDisabled?: boolean;
  items?: MenuItem[];
};

export type SidebarMenuConfig = {
  dashboard: MenuItem;
  signals: MenuItem;
  network?: MenuItem;
  withdrawals?: MenuItem;
  membership: MenuItem;
  settings: MenuItem;
};

export type UserPermissions = {
  role: Role;
  status: UserStatus;
  expirationDate?: Date | null;
  menuConfig: SidebarMenuConfig;
};

export type UserWithRole = {
  id: string;
  name: string;
  email: string;
  role: Role;
  expirationDate?: Date | null;
};

function resolveMembershipStatus(
  membershipStatus?: MembershipState | null,
  expirationDate?: Date | null
): UserStatus {
  if (membershipStatus === "active") {
    return "active";
  }
  if (membershipStatus === "inactive" || membershipStatus === "deleted") {
    return "inactive";
  }
  if (expirationDate) {
    return expirationDate > new Date() ? "active" : "inactive";
  }
  return "inactive";
}

export function getUserPermissions(
  role: Role,
  membershipStatus?: MembershipState | null,
  expirationDate?: Date | null
): UserPermissions {
  const status = role === "admin"
    ? "active"
    : resolveMembershipStatus(membershipStatus, expirationDate);

  const menuConfig: SidebarMenuConfig = {
    dashboard: {
      title: "Dashboard",
      url: "/dashboard",
      isActive: true,
    },
    signals: {
      title: "Signals",
      url: "/signals",
      isDisabled: status === "inactive",
    },
    membership: {
      title: status === "active" ? "My subscription" : "Upgrade",
      url: "/membership",
    },
    settings: {
      title: "Settings",
      url: "/settings",
    },
  };

  if (role === "admin") {
    menuConfig.dashboard = {
      title: "Dashboard",
      url: "/dashboard",
      isActive: true,
    };
    menuConfig.signals = {
      title: "Signals",
      url: "/signals",
    };
    menuConfig.network = {
      title: "Network management",
      url: "/network",
    };
    menuConfig.withdrawals = {
      title: "Wallet",
      url: "/withdrawals",
    };
  } else if (role === "networker" && status === "active") {
    menuConfig.network = {
      title: "Network",
      url: "/network",
      items: [
        {
          title: "Network chart",
          url: "/network/chart",
        },
        {
          title: "Network data",
          url: "/network/data",
        },
      ],
    };
    menuConfig.withdrawals = {
      title: "Wallet",
      url: "/withdrawals",
    };
  } else if (role === "subscriber" && status === "active") {
    menuConfig.signals = {
      title: "Signals",
      url: "/signals",
    };
    menuConfig.network = {
      title: "Network",
      url: "/network",
      items: [
        {
          title: "Network chart",
          url: "/network/chart",
        },
        {
          title: "Network data",
          url: "/network/data",
        },
      ],
    };
    menuConfig.withdrawals = {
      title: "Wallet",
      url: "/withdrawals",
    };
  }

  if (status === "inactive") {
    menuConfig.signals.isDisabled = true;
    if (menuConfig.network) {
      menuConfig.network.isDisabled = true;
    }
    if (menuConfig.withdrawals) {
      menuConfig.withdrawals.isDisabled = true;
    }
  }

  return {
    role,
    status,
    expirationDate,
    menuConfig,
  };
}
