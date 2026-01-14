export type UserRole = "admin" | "guest" | "subscriber" | "networker";

export type UserStatus = "active" | "inactive";

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
  role: UserRole;
  status: UserStatus;
  expirationDate?: Date | null;
  menuConfig: SidebarMenuConfig;
};

export type UserWithRole = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  expirationDate?: Date | null;
};

function isUserActive(role: UserRole, expirationDate?: Date | null): UserStatus {
  if (role === "guest") {
    return "inactive";
  }
  
  if (expirationDate) {
    return expirationDate > new Date() ? "active" : "inactive";
  }
  
  return "active";
}

export function getUserPermissions(
  role: UserRole,
  expirationDate?: Date | null
): UserPermissions {
  const status = isUserActive(role, expirationDate);

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
      title: "Upgrade",
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
      title: "Withdrawal requests",
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
      title: "Withdrawals",
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
      title: "Withdrawals",
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
