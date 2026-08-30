import OrderPage from "@/app/orders/order-page";
export const dynamic = "force-dynamic";
export default function DeliveryPartnersPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) { return <OrderPage mode="delivery-partners" searchParams={searchParams} />; }
