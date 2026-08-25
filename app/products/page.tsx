import { requireProfile } from "@/lib/auth";
import ProductClient from "./product-client";
export const dynamic = "force-dynamic";
export default async function ProductsPage(){const {supabase,profile}=await requireProfile("manager");const {data}=await supabase.from("products").select("id,name,sku,price,stock_quantity,active").order("created_at",{ascending:false});return <ProductClient profile={profile} initialProducts={data||[]}/>}
