import { getBranding } from "@/lib/branding";

export async function BrandMark() {
  const { appName, logoUrl } = await getBranding();
  return (
    <span className="flex items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
      ) : null}
      <span className="font-bold tracking-tight">{appName}</span>
    </span>
  );
}
