import OrderPage from "@/app/orders/order-page";
export const dynamic = "force-dynamic";
export default function WaybillsPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) { return <OrderPage mode="waybills" searchParams={searchParams} />; }
