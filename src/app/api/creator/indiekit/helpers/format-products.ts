export type ProductType = {
  id: string;
  sku: string;
  name: string;
  type: string;
  weight: number | null;
  weightUnit: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: string | null;
  customsCode: string | null;
  countryOfOrigin: string | null;
};

export function formatProducts(products: ProductType[]) {
  return products.map((product) => {
    let status: "ready" | "no_weight" | "no_customs" | "error" = "ready";
    if (product.type === "PHYSICAL") {
      if (!product.weight) status = "no_weight";
      else if (!product.customsCode) status = "no_customs";
    }
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      type: product.type.toLowerCase() as "physical" | "digital",
      weight: product.weight || undefined,
      weightUnit: product.weightUnit || "oz",
      dimensions: product.length && product.width && product.height
        ? { length: product.length, width: product.width, height: product.height, unit: product.dimensionUnit || "in" }
        : undefined,
      customsCode: product.customsCode || undefined,
      countryOfOrigin: product.countryOfOrigin || undefined,
      status,
    };
  });
}
