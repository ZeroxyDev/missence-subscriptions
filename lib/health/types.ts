export type IntegrationCheck = {
  id: "bigblue" | "shopify" | "products";
  label: string;
  status: "ok" | "error";
  detail: string;
};

export type IntegrationHealth = {
  status: "ok" | "error";
  checkedAt: string;
  checks: IntegrationCheck[];
};
