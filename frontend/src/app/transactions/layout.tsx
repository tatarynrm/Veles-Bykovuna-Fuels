/*
  Порожній прошарок. Тут лежав згенерований `create-next-app` RootLayout з
  власними <html lang="en"><body> і title «Next.js» — вкладений у справжній
  кореневий layout, він давав помилку гідратації («<body> cannot be a child of
  <html>»), підмінював заголовок вкладки й жорстко ставив англійську мову в
  обхід автовизначення.

  Файл можна видалити: маршрут прекрасно працює на кореневому layout. Він
  лишений порожнім лише тому, що видалення файлів заблоковано політикою.
*/
export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
