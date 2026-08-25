/**
 * Placeholder widoku, którego iteracja jeszcze nie nadeszła.
 *
 * Iteracja 1 stawia sam fundament (logowanie + rama), więc wszystkie pozostałe trasy
 * z routera muszą istnieć i być osiągalne z sidebara — inaczej nawigacja prowadziłaby
 * w 404. Każdy placeholder mówi wprost, w której iteracji powstanie treść
 * (numery wg `docs/rebuild-roadmap.md` §4).
 */
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export function WidokWPrzygotowaniu({
  tytul,
  opis,
  iteracja,
}: {
  tytul: string;
  opis: string;
  iteracja: string;
}) {
  return (
    <AppShell>
      <PageHeader title={tytul} subtitle={opis} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground" data-testid="text-widok-w-przygotowaniu">
            Ten widok powstanie w <span className="font-medium text-foreground">{iteracja}</span>{" "}
            odbudowy. Iteracja 1 dostarcza logowanie i ramę panelu.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
