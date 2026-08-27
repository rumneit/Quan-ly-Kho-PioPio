import { requireProfile } from "@/lib/auth";
import PurchaseDocumentClient from "@/app/purchasing/purchase-document-client";

export const dynamic = "force-dynamic";
export default async function PurchaseOrdersPage() { const { supabase, profile } = await requireProfile("manager");   const [products, suppliers] = await Promise.all([supabase.from("products").select("id,name,sku,price,cost,stock_quantity,base_unit").eq("active", true).order("name"), supabase.from("suppliers").select("id,name,code,phone,email,group_name").order("name")]); return <PurchaseDocumentClient mode="purchase" profile={profile} products={products.data || []} suppliers={suppliers.data || []} />; }
