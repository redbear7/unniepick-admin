export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
}
