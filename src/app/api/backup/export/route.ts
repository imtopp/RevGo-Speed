import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { getAppName } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  const [
    branches,
    users,
    vehicles,
    suppliers,
    serviceCatalog,
    parts,
    stockMovements,
    services,
    serviceParts,
    payments,
    cashflows,
    systemSettings,
  ] = await Promise.all([
    prisma.branch.findMany(),
    prisma.user.findMany(),
    prisma.vehicle.findMany(),
    prisma.supplier.findMany(),
    prisma.serviceCatalog.findMany(),
    prisma.part.findMany(),
    prisma.stockMovement.findMany(),
    prisma.service.findMany(),
    prisma.servicePart.findMany(),
    prisma.payment.findMany(),
    prisma.cashflow.findMany(),
    prisma.systemSetting.findMany(),
  ]);

  const appName = await getAppName();

  const payload = {
    exportedAt: new Date().toISOString(),
    app: appName,
    data: {
      branches,
      users,
      vehicles,
      suppliers,
      serviceCatalog,
      parts,
      stockMovements,
      services,
      serviceParts,
      payments,
      cashflows,
      systemSettings,
    },
  };

  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  const filename = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
