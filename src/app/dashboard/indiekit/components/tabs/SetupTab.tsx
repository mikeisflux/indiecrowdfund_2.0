"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoxIcon, Link2 } from "lucide-react";

// Import existing tabs from v1
import { ProductsTab } from "../components/tabs";
import { SkuMappingTab } from "../components/tabs";

import type { Product } from "../../types";

interface SetupTabProps {
  products: Product[];
  projectId: string;
}

/**
 * Setup Tab - Products + SKU Mapping
 */
export function SetupTab({
  products,
  projectId,
}: SetupTabProps) {
  const [subTab, setSubTab] = useState("products");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max bg-muted/50">
          <TabsTrigger value="products">
            <BoxIcon className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="sku-mapping">
            <Link2 className="h-4 w-4 mr-2" />
            SKU Mapping
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="products">
          <ProductsTab products={products} projectId={projectId} />
        </TabsContent>

        <TabsContent value="sku-mapping">
          <SkuMappingTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
