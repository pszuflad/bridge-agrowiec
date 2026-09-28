/**
 * Klient TanStack Query — wierne odtworzenie `deminified/frontend-index.js:9054-9079`.
 *
 * Kluczowa konwencja całej aplikacji: KLUCZ ZAPYTANIA JEST ŚCIEŻKĄ.
 * `queryKey.join("/")` skleja segmenty w URL, więc klucz `["/api/staging"]` woła
 * `/api/staging`, a `["/api/staging", id]` → `/api/staging/<id>`. Wszystkie kolejne
 * iteracje i invalidacje (`staging`, `products`, `history`, `alerts`) na tym stoją —
 * nie zmieniać bez przepisania ich wszystkich.
 */
import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { BAZA_API, naglowki, rzucGdyBlad } from "./api";

/**
 * `on401: "returnNull"` z oryginału: zapytanie ODCZYTOWE na wygasłej sesji zwraca `null`,
 * zamiast rzucać. Efekt uboczny wierności: nie ma globalnego auto-wylogowania —
 * użytkownik zobaczy pusty widok, a twardy błąd dopiero przy mutacji.
 */
export const zapytanieZwracajaceNullNa401: QueryFunction = async ({ queryKey }) => {
  const odpowiedz = await fetch(`${BAZA_API}${queryKey.join("/")}`, {
    headers: naglowki(false),
    credentials: "include",
  });
  if (odpowiedz.status === 401) return null;
  await rzucGdyBlad(odpowiedz);
  return await odpowiedz.json();
};

export function utworzQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: zapytanieZwracajaceNullNa401,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = utworzQueryClient();
