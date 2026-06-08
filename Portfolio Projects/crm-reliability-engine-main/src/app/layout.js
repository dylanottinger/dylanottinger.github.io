import "./globals.css";

export const metadata = {
  title: "CRM Reliability Engine",
  description: "Revenue Data Hygiene System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        <main className="min-h-screen p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
