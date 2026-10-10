import { redirect } from "next/navigation";
import { isModuleSlug } from "@/lib/routes";

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  if (!isModuleSlug(slug)) redirect("/don-hang-cung-ung");
  return null;
}
