import OrderPage from "@/app/orders/order-page";
export const dynamic = "force-dynamic";
export default function InvoicesPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) { return <OrderPage mode="invoices" searchParams={searchParams} />; }
