import { redirect } from "next/navigation";

// Root entry redirects to the dashboard. Middleware will further redirect
// to /login if the visitor isn't authenticated.
export default function Home() {
  redirect("/work-sessions");
}
