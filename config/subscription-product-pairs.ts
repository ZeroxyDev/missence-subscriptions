type ConfiguredProduct = {
  sku: string;
  variantId: number;
};

export type SubscriptionProductPair = {
  id: string;
  subscription: ConfiguredProduct;
  experience: ConfiguredProduct & {
    replacement: ConfiguredProduct;
  };
};

export const PRODUCT_PAIRS = [
  {
    id: "MISS_0002_0004",
    subscription: {
      sku: "MISS-000000-0002",
      variantId: 10791019643207,
    },
    experience: {
      sku: "MISS-000000-0004-UP",
      variantId: 10987479859527,
      replacement: {
        sku: "MISS-000000-0004",
        variantId: 10897754554695,
      },
    },
  },
  {
    id: "MISS_0001_0003",
    subscription: {
      sku: "MISS-000000-0001",
      variantId: 10790886310215,
    },
    experience: {
      sku: "MISS-000000-0003-UP",
      variantId: 10987460002119,
      replacement: {
        sku: "MISS-000000-0003",
        variantId: 10897753637191,
      },
    },
  },
] as const satisfies readonly SubscriptionProductPair[];
