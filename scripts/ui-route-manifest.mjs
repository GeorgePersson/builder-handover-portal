export const uiRoutes = [
  { path: "/", kind: "public" },
  { path: "/login", kind: "public" },
  { path: "/client/accept-invite", kind: "protected" },

  { path: "/builder", kind: "protected" },
  { path: "/builder/projects", kind: "protected" },
  { path: "/builder/projects/new", kind: "protected" },
  { path: "/builder/documents", kind: "protected" },
  { path: "/builder/documents/new", kind: "protected" },
  { path: "/builder/maintenance", kind: "protected" },
  { path: "/builder/maintenance/new", kind: "protected" },
  { path: "/builder/products", kind: "protected" },
  { path: "/builder/products/new", kind: "protected" },
  { path: "/builder/handover-package", kind: "protected" },
  { path: "/builder/onboarding", kind: "protected" },
  { path: "/builder/settings", kind: "protected" },
  { path: "/builder/specifications", kind: "protected" },
  { path: "/builder/specifications/new", kind: "protected" },
  { path: "/builder/specifications/review", kind: "protected" },

  { path: "/admin", kind: "protected" },
  { path: "/admin/billing", kind: "protected" },
  { path: "/admin/products", kind: "protected" },
  { path: "/admin/review", kind: "protected" },

  { path: "/client/portal", kind: "protected" },
  { path: "/client/request-product", kind: "protected" },

  {
    path: "/builder/specifications/review/[itemId]/edit",
    kind: "dynamic",
    fixtureRequired: "valid extracted/review item id",
  },
];
