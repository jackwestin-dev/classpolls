import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JW Class Polls — Participation & Accuracy",
  description: "Upload poll screenshots, track participation and in-class accuracy for institutional reporting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
