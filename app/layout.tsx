import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"بصيرة | Baseera Analytics", description:"مختبر تدريبي تفاعلي لتحليل البيانات، فحص جودتها، وبناء قرار يمكن التحقق منه.", icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl"><body className="antialiased">{children}</body></html>}
