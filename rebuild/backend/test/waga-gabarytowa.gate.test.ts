/**
 * GATE ODBUDOWY — Iteracja 9 (waga gabarytowa).
 *
 * Ścieżka kontraktu w zakresie: `POST /api/waga-gabarytowa/oblicz` — jedna operacja.
 *
 * ⚠ SIŁA TEJ SIATKI JEST TU SŁABSZA NIŻ ZWYKLE I NAZYWAMY TO WPROST.
 * Dla tej ścieżki NIE ISTNIEJE ŻADEN FIXTURE — `contract/fixtures/` nie ma nagrania
 * odpowiedzi produkcji (roadmapa §5 I9 zakładała to od początku). Gate dowodzi więc tylko:
 *   1. że operacja istnieje w zamrożonym kontrakcie i odpowiedź 200 się z nim waliduje
 *      (ścieżka, metoda, kod, content-type — `openapi.yaml` nie opisuje ciał schematami);
 *   2. że odpowiedź ma DOKŁADNIE pięć pól z handlera oryginału, ani jednego więcej;
 *   3. że trasa jest pod auth (odstępstwo D2, patrz niżej).
 * Zgodność samych LICZB dowodzi `test/waga-gabarytowa.formula.test.ts` na przykładach
 * wyliczonych ręcznie z kodu oryginału — i to tam leży główny ciężar dowodu.
 * Gdyby ktoś kiedyś nagrał odpowiedź produkcji, ten plik trzeba przepisać na fixture-diff.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajKontrakt,
  type SrodowiskoTestowe,
} from "./gate/index.js";

const SCIEZKA = "/api/waga-gabarytowa/oblicz";

/** Pięć pól z `res.json` oryginału (`deminified/backend-index.cjs:48766-48769`). */
const POLA_ODPOWIEDZI = [
  "opis",
  "szerokoscEfektywna",
  "wagaGabarytowa",
  "wspolczynnik",
  "wysokoscZPaleta",
];

describe("GATE — kontrakt dla wagi gabarytowej", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const oblicz = (cialo: object) =>
    request(srodowisko.app).post(SCIEZKA).set("Authorization", `Bearer ${token}`).send(cialo);

  it("operacja istnieje w contract/openapi.yaml", () => {
    expect(wczytajKontrakt().znajdzOperacje("POST", SCIEZKA)).toBeDefined();
  });

  it("POST z wymiarami zwraca 200 zgodne z kontraktem", async () => {
    const odp = await oblicz({ szerokosc: 70, dlugosc: 100, wysokosc: 15 });

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: SCIEZKA, odpowiedz: odp });
  });

  it("odpowiedź ma dokładnie pięć pól handlera oryginału", async () => {
    const odp = await oblicz({ szerokosc: 70, dlugosc: 100, wysokosc: 15 });

    expect(Object.keys(odp.body as object).sort()).toEqual(POLA_ODPOWIEDZI);
  });

  /**
   * Domyślne `waga_gab.*` NIE SĄ zasiane w bazie testowej — kanon `001_schema.sql` nie
   * wstawia ich, a `GET/PUT /api/config` to Iteracja 11. To sprawdza, że fallback z
   * `odczytajUstawieniaWagiGabarytowej` daje ten sam wynik co produkcja z zasianym configiem:
   * 80 × 100 × (15+10) × 0,000167 = 33,4 kg.
   */
  it("bez wierszy waga_gab.* w bazie liczy na wartościach domyślnych oryginału", async () => {
    const odp = await oblicz({ szerokosc: 70, dlugosc: 100, wysokosc: 15 });

    expect(odp.body).toEqual({
      wagaGabarytowa: 33.4,
      szerokoscEfektywna: 80,
      wysokoscZPaleta: 25,
      wspolczynnik: 0.000167,
      opis: "Szerokość 70 cm > 55 cm, ≤ 80 cm (paleta) → zaokrąglone do 80 cm",
    });
  });

  /**
   * ⚠ BRAK 400 JEST W ORYGINALE. Kontrakt deklaruje dla tej ścieżki kod 400, ale handler
   * produkcji nie ma ani jednej gałęzi walidacji — puste ciało liczy się jako same zera
   * i wychodzi 200. Nie dorabiamy walidacji tylko po to, żeby kod z kontraktu był osiągalny.
   */
  it("puste ciało daje 200, nie 400 — oryginał nie waliduje wejścia", async () => {
    const odp = await oblicz({});

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: SCIEZKA, odpowiedz: odp });
    expect((odp.body as { wagaGabarytowa: number }).wagaGabarytowa).toBe(0);
  });

  /**
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1 z I1, plan.md D2): kontrakt zamraża tę ścieżkę jako PUBLICZNĄ
   * (`openapi.yaml:1157`, `security: []` z komentarzem „stan faktyczny") i produkcja
   * rejestruje ją bez middleware auth. Odbudowa stawia `requireAuth` na wszystkich trasach
   * danych, więc 401 asertujemy WPROST — nie przez `sprawdzZgodnoscZKontraktem`, bo kontrakt
   * nie deklaruje tu kodu 401, a kontraktu (zamrożonego) nie ruszamy. Ten sam zabieg
   * co w `test/narzuty.gate.test.ts` dla `GET /api/markups`.
   */
  it("bez tokenu zwraca 401 (odstępstwo D2 — kontrakt ma tę trasę jako publiczną)", async () => {
    const odp = await request(srodowisko.app).post(SCIEZKA).send({ szerokosc: 70 });

    expect(odp.status).toBe(401);
  });
});
