import { requireProfile } from "@/lib/auth";
import PurchaseDocumentClient from "@/app/purchasing/purchase-document-client";

export const dynamic = "force-dynamic";
export default async function PurchaseReturnsPage() { const { supabase, profile } = await requireProfile("manager"); const [products, suppliers] = await Promise.all([supabase.from("products").select("id,name,sku,price,cost,stock_quantity").eq("active", true).order("name"), supabase.from("suppliers").select("id,name").order("name")]); return <PurchaseDocumentClient mode="return" profile={profile} products={products.data || []} suppliers={suppliers.data || []} />; }
