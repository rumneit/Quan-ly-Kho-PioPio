import OrderPage from "./order-page";
export const dynamic = "force-dynamic";
export default function OrdersPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) { return <OrderPage mode="orders" searchParams={searchParams} />; }
