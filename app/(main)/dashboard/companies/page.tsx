import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";

import {
  CompaniesManager,
  type CompanyView,
  type OpportunityView,
  type UserOption,
} from "@/components/custom/companies-manager";
import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import {
  companies,
  companyMembers,
  opportunities,
  users,
} from "@/lib/db/schema";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 30 — müşteri şirket yönetimi (P3.1). Üyeler iki sorgudan JS'te
// gruplanır (fan-out yok); kullanıcılar üye seçici için tek sorguda gelir.
export default async function CompaniesPage() {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  let items: CompanyView[] = [];
  let userOptions: UserOption[] = [];
  let opportunityItems: OpportunityView[] = [];
  let loadError = false;

  try {
    const [companyRows, memberRows, userRows, opportunityRows] =
      await Promise.all([
        getDb()
          .select()
          .from(companies)
          .where(eq(companies.workspaceId, await getWorkspaceId()))
          .orderBy(asc(companies.name)),
        getDb()
          .select({
            id: companyMembers.id,
            companyId: companyMembers.companyId,
            userId: companyMembers.userId,
            jobTitle: companyMembers.jobTitle,
            userName: users.name,
            userEmail: users.email,
          })
          .from(companyMembers)
          .innerJoin(users, eq(users.id, companyMembers.userId))
          .orderBy(asc(users.name)),
        getDb()
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .orderBy(asc(users.name)),
        getDb()
          .select({
            id: opportunities.id,
            companyId: opportunities.companyId,
            title: opportunities.title,
            dealValue: opportunities.dealValue,
            stage: opportunities.stage,
            expectedCloseDate: opportunities.expectedCloseDate,
            notes: opportunities.notes,
          })
          .from(opportunities)
          .where(eq(opportunities.workspaceId, await getWorkspaceId()))
          .orderBy(desc(opportunities.createdAt)),
      ]);

    const membersByCompany = new Map<string, CompanyView["members"]>();
    for (const member of memberRows) {
      const list = membersByCompany.get(member.companyId) ?? [];
      list.push({
        id: member.id,
        userId: member.userId,
        jobTitle: member.jobTitle,
        userName: member.userName ?? member.userEmail,
        userEmail: member.userEmail,
      });
      membersByCompany.set(member.companyId, list);
    }

    items = companyRows.map((company) => ({
      id: company.id,
      name: company.name,
      domain: company.domain,
      mrr: company.mrr,
      status: company.status,
      renewalDate: company.renewalDate,
      segment: company.segment,
      notes: company.notes,
      members: membersByCompany.get(company.id) ?? [],
    }));

    userOptions = userRows.map((user) => ({
      id: user.id,
      label: user.name ? `${user.name} (${user.email})` : user.email,
    }));

    opportunityItems = opportunityRows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      dealValue: row.dealValue ?? "0",
      stage: row.stage,
      expectedCloseDate: row.expectedCloseDate,
      notes: row.notes,
    }));
  } catch (err) {
    console.error(
      "Companies page load failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Şirketler</h1>
      <p className="mt-2 text-muted-foreground">
        Müşteri şirketlerini, üyelerini ve MRR bağlamını yönet — üyelerin
        oyları dashboard&apos;da &quot;müşteri&quot; sayacını besler.
      </p>

      <div className="mt-8">
        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Şirketler yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
        ) : (
          <CompaniesManager
            items={items}
            userOptions={userOptions}
            opportunities={opportunityItems}
          />
        )}
      </div>
    </main>
  );
}
