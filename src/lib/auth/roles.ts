import type { Role } from "@/lib/types";

export const builderRoles: Role[] = ["owner", "builder_admin"];

export function canManageBuilderWorkspace(role: Role) {
  return builderRoles.includes(role);
}

export function canViewClientPortal(role: Role) {
  return role === "client";
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    owner: "Organisation owner",
    builder_admin: "Builder admin",
    client: "Homeowner",
  };

  return labels[role];
}
