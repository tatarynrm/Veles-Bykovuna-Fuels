/*
  Порожній прошарок — див. коментар у app/workflow/ruptela/layout.tsx.
  Вкладені <html>/<body> тут ламали б гідратацію і мову.
*/
export default function NovaPoshtaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
