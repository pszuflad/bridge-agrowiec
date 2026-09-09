// ─────────────────────────────────────────────────────────────────────────────
//  Schemat Drizzle — WYGENEROWANY, nie edytuj ręcznie poza sekcją „dopieszczenia".
//
//  Pochodzenie:  npx drizzle-kit pull  z bazy zbudowanej z rebuild/schema/001_schema.sql
//  (26 tabel, 269 kolumn, 16 indeksów). Źródłem prawdy o strukturze jest
//  001_schema.sql — ten plik z niego WYNIKA, nie odwrotnie (rebuild/schema/README.md).
//
//  Regeneracja po dodaniu migracji (002_*.sql itd.):
//    rm -f .tmp/introspect.db && node -e "…" (patrz README, sekcja „Schemat Drizzle")
//    DB_PATH=./.tmp/introspect.db npx drizzle-kit pull
//    → skopiuj .drizzle/schema.ts tutaj i nanieś ponownie dopieszczenia z dołu pliku.
//
//  Konwencja nazw: baza snake_case (`haslo_hash`), TypeScript/API camelCase
//  (`hasloHash`) — zgodnie z kontraktem (contract/README.md: „API zwraca camelCase").
//  Terminy domenowe po polsku ZOSTAJĄ (kategoria, zastosowanie, cenaZakupu, dostawca).
// ─────────────────────────────────────────────────────────────────────────────
import { sqliteTable, AnySQLiteColumn, index, integer, text, real, foreignKey, primaryKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const products = sqliteTable("products", {
	id: integer().primaryKey({ autoIncrement: true }),
	kod: text().notNull(),
	nazwa: text().notNull(),
	marka: text().notNull(),
	kategoria: text().notNull(),
	dostawca: text().notNull(),
	magazyn: text().notNull(),
	stan: integer().notNull(),
	cenaZakupu: real("cena_zakupu").notNull(),
	cenaSprzedazy: real("cena_sprzedazy").notNull(),
	marzaPct: real("marza_pct").notNull(),
	vat: integer().default(23).notNull(),
	ean: text(),
	eanRaw: text("ean_raw"),
	eanIsValid: integer("ean_is_valid"),
	eanSourceStatus: text("ean_source_status"),
	eanCandidates: text("ean_candidates"),
	status: text().default("aktywny").notNull(),
	magazynRaw: text("magazyn_raw"),
	dataAktualizacji: text("data_aktualizacji").notNull(),
	rozmiar: text(),
	// Migracja 003 (backlog #3, saga `szertxt`): kolumna jest TEXT, nie REAL. Parser oddaje
	// pierwszą liczbę z rozmiaru jako NAPIS, z zerami końcowymi („10.00", „800") — REAL by je
	// zjadł przez type affinity. Nie zmieniać bez przenagrania GET_products.json (I12).
	szerokosc: text(),
	profil: real(),
	srednica: real(),
	konstrukcja: text(),
	indeksNosnosci: text("indeks_nosnosci"),
	indeksPredkosci: text("indeks_predkosci"),
	pr: text(),
	tlTt: text("tl_tt"),
	vfIf: text("vf_if"),
	bieznik: text(),
	model: text(),
	dot: text(),
	rodzaj: text(),
	sku: text(),
	kodDostawcy: text("kod_dostawcy"),
	rozmiarAlternatywny: text("rozmiar_alternatywny"),
	sf: text(),
	sb: text(),
	hf: text(),
	ls: text(),
	// dopieszczenie (ticket 3-FEATURE-katalog-odczyt, D5): introspekcja zrobiła z tych
	// dziesięciu kolumn zwykłe `integer()`, a oryginał trzyma je w trybie boolean
	// (backend-index.cjs:43733-43780). Bez tego API zwracałoby 0/1 zamiast false/true
	// i rozjechałoby się z contract/fixtures/GET_products.json. `NULL` zostaje `null`.
	// UWAGA: `eanIsValid` celowo ZOSTAJE zwykłym integer() — oryginał też go nie boolean-uje,
	// a fixture ma tam liczbę 1.
	reinforced: integer({ mode: "boolean" }),
	extraLoad: integer("extra_load", { mode: "boolean" }),
	cutResistant: integer("cut_resistant", { mode: "boolean" }),
	heatResistant: integer("heat_resistant", { mode: "boolean" }),
	stubbleResistant: integer("stubble_resistant", { mode: "boolean" }),
	nro: integer({ mode: "boolean" }),
	cho: integer({ mode: "boolean" }),
	indeksy: text(),
	indeks1: text("indeks_1"),
	indeks2: text("indeks_2"),
	dostepnosc: text(),
	waga: real(),
	dlugosc: real(),
	szerokoscPaczki: real("szerokosc_paczki"),
	wysokosc: real(),
	labelNoise: text("label_noise"),
	labelWet: text("label_wet"),
	labelRolling: text("label_rolling"),
	labelIce: text("label_ice"),
	labelSnow: text("label_snow"),
	linkZdjecia: text("link_zdjecia"),
	oznaczenieBieznika: text("oznaczenie_bieznika"),
	sezon: text(),
	ms: integer({ mode: "boolean" }),
	// dopieszczenie (D5): `drizzle-kit pull` scamelizował `snow_3pmsf` na `snow3Pmsf`,
	// oryginał i fixture mają `snow3pmsf` (backend-index.cjs:43775).
	snow3pmsf: integer("snow_3pmsf", { mode: "boolean" }),
	wentyl: text(),
	cfo: integer({ mode: "boolean" }),
	wysokoscPrzesylki: real("wysokosc_przesylki"),
	zastosowanie: text(),
	kodImportu: text("kod_importu"),
	nieobecnoscPodRzad: integer("nieobecnosc_pod_rzad").default(0).notNull(),
	// dopieszczenie (migracja 002, plan.md D9): kolumna spoza kanonu produkcji.
	// NIE wychodzi w API — repos/products.ts wybiera kolumny projekcją kontraktową.
	// Pisarz i `GET /api/products/uwagi-cena` dochodzą w 3d.
	uwagaCena: text("uwaga_cena"),
},
(table) => [
	index("idx_products_kod_importu").on(table.kodImportu),
]);

export const stagingItems = sqliteTable("staging_items", {
	id: integer().primaryKey({ autoIncrement: true }),
	typZmiany: text("typ_zmiany").notNull(),
	kod: text().notNull(),
	nazwa: text().notNull(),
	dostawca: text().notNull(),
	magazyn: text().notNull(),
	stanStary: integer("stan_stary"),
	stanNowy: integer("stan_nowy"),
	cenaZakupuStara: real("cena_zakupu_stara"),
	cenaZakupuNowa: real("cena_zakupu_nowa"),
	cenaSprzedazyNowa: real("cena_sprzedazy_nowa"),
	zmianaPct: real("zmiana_pct"),
	ostrzezenie: text(),
	powod: text(),
	snapshotJson: text("snapshot_json"),
	eanRaw: text("ean_raw"),
	eanIsValid: integer("ean_is_valid"),
	eanSourceStatus: text("ean_source_status"),
	eanCandidates: text("ean_candidates"),
	magazynRaw: text("magazyn_raw"),
	edytowanePola: text("edytowane_pola"),
	utworzono: text().notNull(),
	zatwierdzilUzytkownikId: integer("zatwierdzil_uzytkownik_id"),
	zatwierdzonoData: text("zatwierdzono_data"),
});

export const manualOverrides = sqliteTable("manual_overrides", {
	id: integer().primaryKey({ autoIncrement: true }),
	supplierKod: text("supplier_kod").notNull(),
	supplierProductId: text("supplier_product_id").notNull(),
	fieldName: text("field_name").notNull(),
	overrideValue: text("override_value").notNull(),
	reason: text(),
	createdBy: integer("created_by"),
	createdAt: text("created_at").notNull(),
	acknowledgedSourceValue: text("acknowledged_source_value"),
});

export const alerts = sqliteTable("alerts", {
	id: integer().primaryKey({ autoIncrement: true }),
	poziom: text().notNull(),
	typ: text().notNull(),
	opis: text().notNull(),
	dostawca: text(),
	status: text().default("nowy").notNull(),
	data: text().notNull(),
});

export const history = sqliteTable("history", {
	id: integer().primaryKey({ autoIncrement: true }),
	data: text().notNull(),
	kodProduktu: text("kod_produktu").notNull(),
	nazwa: text().notNull(),
	pole: text().notNull(),
	staraWartosc: text("stara_wartosc"),
	nowaWartosc: text("nowa_wartosc"),
	zrodlo: text().notNull(),
	kto: text().notNull(),
	wykonalUzytkownikId: integer("wykonal_uzytkownik_id"),
});

export const markups = sqliteTable("markups", {
	id: integer().primaryKey({ autoIncrement: true }),
	typ: text().notNull(),
	zakres: text().notNull(),
	warunki: text(),
	nazwa: text(),
	wartosc: real().notNull(),
	jednostka: text().default("procent").notNull(),
	priorytet: integer().default(50).notNull(),
	status: text().default("aktywny").notNull(),
	zmienilUzytkownikId: integer("zmienil_uzytkownik_id"),
	zmienionoData: text("zmieniono_data"),
});

export const promotions = sqliteTable("promotions", {
	id: integer().primaryKey({ autoIncrement: true }),
	nazwa: text().notNull(),
	rabatPct: real("rabat_pct").notNull(),
	zasieg: text().notNull(),
	warunki: text(),
	priorytet: integer().default(50),
	start: text().notNull(),
	koniec: text().notNull(),
	status: text().default("aktywna").notNull(),
	zmienilUzytkownikId: integer("zmienil_uzytkownik_id"),
	zmienionoData: text("zmieniono_data"),
});

export const suppliers = sqliteTable("suppliers", {
	id: integer().primaryKey({ autoIncrement: true }),
	kod: text().notNull(),
	nazwa: text().notNull(),
	email: text(),
	formatPliku: text("format_pliku").notNull(),
	sposobDostarczania: text("sposob_dostarczania").notNull(),
	url: text(),
	czestotliwoscMinuty: integer("czestotliwosc_minuty"),
	status: text().default("aktywny").notNull(),
	ostatniPlik: text("ostatni_plik"),
	ostatniaSync: text("ostatnia_sync"),
	liczbaProduktow: integer("liczba_produktow").default(0).notNull(),
	parser: text(),
	kodowanie: text(),
	uwagi: text(),
	// dopieszczenie (migracja 002, plan.md D5): kolumna spoza kanonu produkcji.
	// NIE wychodzi w API — repos/suppliers.ts wybiera kolumny projekcją kontraktową.
	importWylaczony: integer("import_wylaczony").default(0).notNull(),
});

export const users = sqliteTable("users", {
	id: integer().primaryKey({ autoIncrement: true }),
	// dopieszczenie: UNIQUE jest w 001_schema.sql, introspekcja nie przenosi
	// ograniczeń inline — dopisane ręcznie, żeby typ odzwierciedlał bazę
	email: text().notNull().unique(),
	hasloHash: text("haslo_hash").notNull(),
	imieNazwisko: text("imie_nazwisko").notNull(),
	utworzono: text().notNull(),
	ostatnieLogowanie: text("ostatnie_logowanie"),
});

export const auditLog = sqliteTable("audit_log", {
	id: integer().primaryKey({ autoIncrement: true }),
	uzytkownikId: integer("uzytkownik_id"),
	uzytkownikImie: text("uzytkownik_imie"),
	akcja: text().notNull(),
	encjaTyp: text("encja_typ"),
	encjaId: text("encja_id"),
	szczegolyJson: text("szczegoly_json"),
	kiedy: text().notNull(),
});

export const spedycjaLimity = sqliteTable("spedycja_limity", {
	id: integer().primaryKey({ autoIncrement: true }),
	// UNIQUE jest w `rebuild/schema/001_schema.sql:206` i w oryginale
	// (`backend-index.cjs:43952-43959`); odbicie Drizzle je gubiło. Na tym ograniczeniu
	// stoi upsert w `repos/spedycja.ts` — bez niego `onConflictDoUpdate` nie ma o co zaczepić.
	dostawcaKod: text("dostawca_kod").notNull().unique(),
	progNetto: real("prog_netto"),
	kosztPonizej: real("koszt_ponizej"),
	kosztPowyzej: real("koszt_powyzej"),
	dodatkoweReguly: text("dodatkowe_reguly"),
});

export const config = sqliteTable("config", {
	klucz: text().primaryKey(),
	wartosc: text().notNull(),
});

export const atrybutyRodzaje = sqliteTable("atrybuty_rodzaje", {
	value: text().primaryKey(),
	label: text().notNull(),
	opis: text(),
	core: integer().default(0).notNull(),
	utworzony: text().default("sql`(datetime('now'))`").notNull(),
});

export const atrybutyWartosci = sqliteTable("atrybuty_wartosci", {
	id: integer().primaryKey({ autoIncrement: true }),
	rodzaj: text().notNull().references(() => atrybutyRodzaje.value, { onDelete: "cascade" } ),
	wartosc: text().notNull(),
	utworzony: text().default("sql`(datetime('now'))`").notNull(),
	origin: text().default("user").notNull(),
	utworzono: text().default("").notNull(),
},
(table) => [
	index("idx_atrybuty_wartosci_rodzaj").on(table.rodzaj),
]);

export const historiaCen = sqliteTable("historia_cen", {
	id: integer().primaryKey({ autoIncrement: true }),
	produktId: integer("produkt_id"),
	kod: text().notNull(),
	ean: text(),
	dostawca: text().notNull(),
	marka: text(),
	model: text(),
	rozmiar: text(),
	indeksNosnosci: text("indeks_nosnosci"),
	indeksPredkosci: text("indeks_predkosci"),
	kategoria: text(),
	cenaZakupu: real("cena_zakupu"),
	cenaSprzedazy: real("cena_sprzedazy"),
	stan: integer(),
	zarejestrowanoAt: text("zarejestrowano_at").default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_historia_cen_rozmiar").on(table.rozmiar),
	index("idx_historia_cen_marka").on(table.marka),
	index("idx_historia_cen_dostawca_data").on(table.dostawca, table.zarejestrowanoAt),
	index("idx_historia_cen_ean_data").on(table.ean, table.zarejestrowanoAt),
	index("idx_historia_cen_kod_data").on(table.kod, table.zarejestrowanoAt),
]);

export const atrybutyWartosciPending = sqliteTable("atrybuty_wartosci_pending", {
	id: integer().primaryKey({ autoIncrement: true }),
	rodzaj: text().notNull(),
	wartosc: text().notNull(),
	ileWystapien: integer("ile_wystapien").default(1).notNull(),
	pierwszyImport: text("pierwszy_import").default("sql`(datetime('now'))`").notNull(),
	ostatniImport: text("ostatni_import").default("sql`(datetime('now'))`").notNull(),
	dostawcy: text().default(""),
},
(table) => [
	index("idx_pending_rodzaj").on(table.rodzaj),
]);

export const atrybutyWartosciOdrzucone = sqliteTable("atrybuty_wartosci_odrzucone", {
	id: integer().primaryKey({ autoIncrement: true }),
	rodzaj: text().notNull(),
	wartosc: text().notNull(),
	odrzucono: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_odrzucone_rodzaj").on(table.rodzaj),
]);

export const sellyProducts = sqliteTable("selly_products", {
	id: integer().primaryKey({ autoIncrement: true }),
	bridgeKod: text("bridge_kod").notNull(),
	sellyProductId: integer("selly_product_id").notNull(),
	sellyCategoryId: integer("selly_category_id"),
	sellyProducerId: integer("selly_producer_id"),
	ostatniaSync: text("ostatnia_sync").default("sql`(datetime('now'))`").notNull(),
	ostatniStatus: text("ostatni_status").default("ok").notNull(),
	ostatniBlad: text("ostatni_blad"),
	cenaSprzedazyWyslana: real("cena_sprzedazy_wyslana"),
	cenaZakupuWyslana: real("cena_zakupu_wyslana"),
	stanWyslany: integer("stan_wyslany"),
	utworzono: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_selly_products_status").on(table.ostatniStatus),
	index("idx_selly_products_kod").on(table.bridgeKod),
]);

export const sellyDict = sqliteTable("selly_dict", {
	slownik: text().notNull(),
	klucz: text().notNull(),
	wartoscId: integer("wartosc_id").notNull(),
	rawJson: text("raw_json"),
	odswiezono: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	primaryKey({ columns: [table.slownik, table.klucz], name: "selly_dict_slownik_klucz_pk"})
]);

export const sellySyncLog = sqliteTable("selly_sync_log", {
	id: integer().primaryKey({ autoIncrement: true }),
	operacja: text().notNull(),
	dostawcaKod: text("dostawca_kod"),
	liczbaOk: integer("liczba_ok").default(0).notNull(),
	liczbaBlad: integer("liczba_blad").default(0).notNull(),
	liczbaSkip: integer("liczba_skip").default(0).notNull(),
	szczegolyJson: text("szczegoly_json"),
	uzytkownikId: integer("uzytkownik_id"),
	uzytkownikImie: text("uzytkownik_imie"),
	rozpoczeto: text().default("sql`(datetime('now'))`").notNull(),
	zakonczono: text(),
	status: text().default("w_trakcie").notNull(),
},
(table) => [
	index("idx_selly_sync_log_dostawca").on(table.dostawcaKod),
	index("idx_selly_sync_log_data").on(table.rozpoczeto),
]);

export const linkPamiecKod = sqliteTable("link_pamiec_kod", {
	kod: text().primaryKey(),
	link: text().notNull(),
	updatedAt: text("updated_at"),
});

export const linkPamiecMr = sqliteTable("link_pamiec_mr", {
	mrkey: text().primaryKey(),
	link: text().notNull(),
	updatedAt: text("updated_at"),
});

export const sellyKategoriaNormMap = sqliteTable("selly_kategoria_norm_map", {
	kategoriaRaw: text("kategoria_raw").notNull(),
	kategoriaGlownaNorm: text("kategoria_glowna_norm").notNull(),
	categoryIdGlowna: integer("category_id_glowna").notNull(),
});

export const sellyZastosowanieCategoryMap = sqliteTable("selly_zastosowanie_category_map", {
	zastosowanie: text().notNull(),
	categoryIdGlowna: integer("category_id_glowna"),
	categoryIdZastosowanie: integer("category_id_zastosowanie"),
	dziedziczyKategorieProduktu: integer("dziedziczy_kategorie_produktu").default(0).notNull(),
	utworzony: text().default("sql`(datetime('now'))`").notNull(),
});

export const nazwaPamiec = sqliteTable("nazwa_pamiec", {
	kodImportu: text("kod_importu").primaryKey(),
	nazwa: text().notNull(),
	updatedAt: text("updated_at"),
	source: text(),
});

export const wagaPamiec = sqliteTable("waga_pamiec", {
	kod: text().primaryKey(),
	waga: real().notNull(),
	updatedAt: text("updated_at"),
	source: text(),
});

