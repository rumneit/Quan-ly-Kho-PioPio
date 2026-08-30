import OrderPage from "@/app/orders/order-page";
export const dynamic = "force-dynamic";
export default function ReturnsPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) { return <OrderPage mode="returns" searchParams={searchParams} />; }
