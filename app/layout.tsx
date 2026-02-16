import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Cordless",
  description: "Discord alternative prototype with Supabase realtime"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
