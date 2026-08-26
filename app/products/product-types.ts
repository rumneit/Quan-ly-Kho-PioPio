export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost?: number;
  stock_quantity: number;
  active: boolean;
  created_at?: string;
  category_id?: string | null;
  category_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  product_type?: "product" | "service" | "combo";
  direct_sale?: boolean;
  linked_sale_channel?: boolean;
  expected_out_of_stock_at?: string | null;
  description?: string | null;
  note?: string | null;
  brand?: string | null;
  location?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
};

export type ProductFilters = {
  categoryIds: string[];
  inventoryCriteria: "all" | "below_min" | "above_min" | "in_stock" | "out_of_stock" | "custom";
  inventoryOperator: "=" | ">" | ">=" | "<" | "<=" | "between";
  inventoryMin?: number;
  inventoryMax?: number;
  expectedPreset: string;
  expectedFrom?: string;
  expectedTo?: string;
  createdPreset: string;
  createdFrom?: string;
  createdTo?: string;
  supplierIds: string[];
  productType: "all" | "product" | "service" | "combo";
  directSale: "all" | "yes" | "no";
  linkedSaleChannel: "all" | "yes" | "no";
  status: "active" | "inactive" | "all";
};

export type FilterOption = { id: string; name: string; count?: number; children?: FilterOption[] };

export const DEFAULT_FILTERS: ProductFilters = {
  categoryIds: [], inventoryCriteria: "all", inventoryOperator: "=", expectedPreset: "all", createdPreset: "all",
  supplierIds: [], productType: "all", directSale: "all", linkedSaleChannel: "all", status: "active",
};
