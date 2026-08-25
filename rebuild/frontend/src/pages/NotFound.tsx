/**
 * 404 — odpowiednik `deminified/frontend-index.js:16534-16556` (`p2`).
 *
 * ODSTĘPSTWO O3 (plan.md): oryginał miał tu angielski tekst („404 Page Not Found" /
 * „Did you forget to add the page to the router?") na `bg-gray-50` i `text-gray-*` —
 * jedyny ekran aplikacji poza design tokenami, wyglądający na niedokończony.
 * Tłumaczymy na polski i przenosimy na tokeny; struktura (karta, ikona, nagłówek,
 * akapit) zostaje.
 */
import { CircleAlert } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

export function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <CircleAlert className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">404 — nie znaleziono strony</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Taki adres nie istnieje w panelu. Sprawdź link albo{" "}
            <Link href="/" className="text-primary underline underline-offset-4">
              wróć na pulpit
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
