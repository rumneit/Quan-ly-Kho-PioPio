import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const admin = createAdminClient();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  if ((count || 0) > 0) redirect("/login");
  return <SetupForm />;
}
