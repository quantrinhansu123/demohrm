import { ClientApp } from "@/components/layout/ClientApp";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientApp />
      {children}
    </>
  );
}
