import { redirect } from "next/navigation";
import { getAuthenticatedSession } from "@/server/auth/session";

export default async function RootPage() {
  const session = await getAuthenticatedSession();
  redirect(session ? "/beranda" : "/login");
}
