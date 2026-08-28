import { requireProfile } from "@/lib/auth";
import CustomersClient, { type CustomerGroup, type SourceCustomer } from "./customers-client";

export const dynamic = "force-dynamic";

const customerSelect = "id,customer_number,name,phone,secondary_phone,email,birthday,gender,customer_type,facebook,address,area,ward,note,tax_code,identity_number,organization,buyer_name,invoice_address,invoice_email,bank_name,bank_account,total_spent,active,favorite,group_id,created_at,updated_at,created_by,creator:profiles!customers_created_by_fkey(full_name),customer_groups(id,name),orders(id,order_number,status,total,created_at,shipments(status,cod_amount,collected_cod),sales_returns(id,return_number,status,refund_amount,created_at))";
const legacyCustomerSelect = "id,name,phone,email,total_spent,created_at,created_by,creator:profiles!customers_created_by_fkey(full_name),orders(id,order_number,status,total,created_at)";

export default async function CustomersPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [customers, groups, creators] = await Promise.all([
    supabase.from("customers").select(customerSelect, { count: "exact" }).order("customer_number", { ascending: false }).range(0, 14),
    supabase.from("customer_groups").select("id,name").order("name"),
    supabase.from("profiles").select("id,full_name").eq("active", true).order("full_name"),
  ]);
  let customerData: unknown = customers.data;
  let count = customers.count || 0;
  if (customers.error) {
    const legacy = await supabase.from("customers").select(legacyCustomerSelect, { count: "exact" }).order("created_at", { ascending: false }).range(0, 14);
    customerData = legacy.data;
    count = legacy.count || 0;
  }
  return (
    <CustomersClient
      profile={profile}
      initialCustomers={(customerData || []) as unknown as SourceCustomer[]}
      initialCount={count}
      groups={(groups.data || []) as CustomerGroup[]}
      creators={creators.data || []}
      dataWarning={customers.error || groups.error ? "Một số dữ liệu khách hàng chưa sẵn sàng. Vui lòng áp dụng migration 008." : ""}
    />
  );
}
