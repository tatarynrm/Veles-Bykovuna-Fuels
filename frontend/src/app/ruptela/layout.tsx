/*
  Порожній прошарок — див. коментар у app/transactions/layout.tsx.
  Тут був згенерований RootLayout із вкладеними <html>/<body>; на /ruptela/*
  він ламав гідратацію і ставив lang="en" поверх обраної мови.
  Файл можна видалити.
*/
export default function RuptelaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
