-- 023_order_delivering_enum: Them trang thai "dang giao" cho don hang.
-- QUAN TRONG: chay RIENG file nay TRUOC file 024 (PostgreSQL khong cho dung
-- gia tri enum vua them trong cung mot transaction).

alter type public.order_status add value if not exists 'delivering';
