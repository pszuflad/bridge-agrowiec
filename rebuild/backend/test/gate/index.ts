// Punkt wejścia harnessu GATE — kolejne iteracje importują stąd.
//
// Wzorzec użycia w teście iteracji (np. I2, katalog):
//
//   const srodowisko = await stworzSrodowiskoTestowe();
//   const token = podpiszToken(srodowisko.uzytkownik, SEKRET_TESTOWY);
//   const odp = await request(srodowisko.app).get("/api/products").set("Authorization", `Bearer ${token}`);
//   sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/products", odpowiedz: odp });
//   sprawdzZgodnoscZFixture("GET_products.json", odp.body);
//
export * from "./aplikacja.js";
export * from "./baza.js";
export * from "./fixtures.js";
export * from "./kontrakt.js";
export * from "./ksztalt.js";
export * from "./repo.js";
export * from "./asercje.js";
