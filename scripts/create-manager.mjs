import { createClient } from "@supabase/supabase-js";

const [username, password, fullName = "Quản lý PioPio"] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node scripts/create-manager.mjs <username> <password> [full name]");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Missing Supabase environment variables");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: store, error: storeError } = await supabase.from("stores").insert({ name: "Kho PioPio" }).select().single();
if (storeError) throw storeError;
const email = `${username.toLowerCase()}@auth.khopiopio.app`;
const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, full_name: fullName } });
if (error) throw error;
const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, store_id: store.id, username, full_name: fullName, role: "manager", active: true });
if (profileError) throw profileError;
console.log(`Manager created: ${username}`);
