export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {children}
    </div>
  );
}
