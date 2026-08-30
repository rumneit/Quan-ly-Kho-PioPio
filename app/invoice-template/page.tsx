import { requireProfile } from "@/lib/auth";
import InvoiceTemplateClient from "./invoice-template-client";

export const dynamic = "force-dynamic";

export default async function InvoiceTemplatePage() {
  const { profile } = await requireProfile();
  return <InvoiceTemplateClient profile={profile} />;
}
