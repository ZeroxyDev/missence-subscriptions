type ConfiguredProduct = {
  sku: string;
  productId: number;
  variantId: number | null;
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
      productId: 10791019643207,
      variantId: 53887845564743,
    },
    experience: {
      sku: "MISS-000000-0004-UP",
      productId: 10987479859527,
      variantId: 54579708854599,
      replacement: {
        sku: "MISS-000000-0004",
        productId: 10897754554695,
        variantId: 54311286243655,
      },
    },
  },
  {
    id: "MISS_0001_0003",
    subscription: {
      sku: "MISS-000000-0001",
      productId: 10790886310215,
      variantId: 54328475517255,
    },
    experience: {
      sku: "MISS-000000-0003-UP",
      productId: 10987460002119,
      variantId: 54579583025479,
      replacement: {
        sku: "MISS-000000-0003",
        productId: 10897753637191,
        variantId: 54311284736327,
      },
    },
  },
] as const satisfies readonly SubscriptionProductPair[];
