export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ overflow: 'auto', height: '100%' }}>{children}</div>
}
