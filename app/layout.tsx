import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"بصيرة | Baseera Analytics", description:"مساحة عربية لعرض بيانات Excel وتعديلها وتنظيفها وتحليلها، مع خطط AI قابلة للمراجعة وتقارير مرتبطة بالأرقام.", icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl"><body className="antialiased">{children}</body></html>}
