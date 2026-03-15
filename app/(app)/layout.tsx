// Este layout ya no se usa — la lógica de auth está en AppShell.
// Las páginas viven en app/dashboard/, app/calculadora/, etc.
export default function UnusedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
