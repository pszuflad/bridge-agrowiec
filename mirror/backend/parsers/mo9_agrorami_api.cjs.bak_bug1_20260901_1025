// MO9 Agrorami — źródło danych: API GraphQL (hurtownia.agrorami.pl)
// Zastępuje pobieranie pliku agrorami.csv. Zwraca records[] w DOKŁADNIE tym samym
// kształcie co parsers/mo9_agrorami.cjs (parseFile) — z record.surowe_pola zawierającym
// klucze, których oczekuje adapter → tyre.normalizeAgrorami:
//   id, ean, producent, bieznik, rozmiar, nosnosc, predkosc, 'tl/tt', plotna,
//   cena, magazyn, waga, kategoria, sezon
//
// KLUCZOWE MAPOWANIE STANU (decyzja Anny 2026-07-09):
//   stock_availability.in_stock_real  →  surowe_pola.magazyn
//   Wartość "5+" zostaje jako string — common.cjs normalizeQty() zetnie "+" i da 5.
//   in_stock_real == null  →  brak stanu (magazyn=null) → normalizeQty → null → pozycja
//   będzie potraktowana przez tk() jako stan 0 przy zapisie do stagingu (stanNowy: d.stan ?? 0).
//
// Token: ważny 1h. Lazy auto-refresh w pamięci procesu (bufor 5 min, retry raz na 401).
// Dane logowania z .env: AGRORAMI_EMAIL, AGRORAMI_PASSWORD.

'use strict';

const c = require('../common.cjs');

// Dedykowany parser nazwy handlowej Agrorami API (dodane 2026-07-10).
// KONTEKST: normalizeAgrorami() w tyre_params.cjs oczekuje ROZBITYCH pól
// (bieznik=czysty model, nosnosc, predkosc, plotna, tlTt) — tak jak dawał stary CSV.
// API GraphQL daje tylko JEDNO pole `name` z pełną nazwą handlową, np.:
//   "Opona BKT AGRIMAX RT 855 E TL 520/85R38 / 20,8R38 (170A8/B)"
// Przekazywanie całej nazwy jako "bieznik" (poprzednie podejście) powodowało, że
// normalizator dublował markę/oznaczenia w nazwaKoncowa i źle wyłuskiwał LI/SI
// z tekstu (fallback parseTechnicalMarks nie był projektowany pod ten format).
// Ta funkcja rozbija nazwę na te same pola, jakie dawał CSV, PRZED wywołaniem
// normalizatora — więc normalizator dostaje dane w formacie, pod który był pisany,
// i nie trzeba zmieniać niczego w tyre_params.cjs / adapter.cjs.
//
// Zweryfikowane na całym katalogu (1113 pozycji, kategoria "Opony BKT", 2026-07-10):
// 100% rekordów ma wykrywalny rozmiar; model wychodzi czysty (np. "AGRIMAX RT 855 E").

const TECH_MARKERS = ['IF', 'VF', 'IND', 'CHO', 'CFO', 'NRO'];

// Rozmiar: cyfry [+ / + cyfry opcjonalnie] + separator (x/X/R/L/-) [+ L] + cyfry [+ -cyfry]
// Przykłady dopasowań: "520/85R38", "8,25x20", "17,5LR24", "20X10,00-10", "9,0/70X16"
// POPRAWKA 2026-07-21 (anomalia 1: ucieta 4-cyfrowa szerokosc): pierwsza grupa szerokosci
// zmieniona z \d{1,3} na \d{1,4}, bo BKT ma opony o szerokosci 1050/1250 mm (np.
// "1050/50R32", "1250/50R32"). Wczesniej \d{1,3} dopasowywalo tylko "050"/"250", a odcieta
// cyfra "1" wpadala do modelu ("AGRIMAX RT 600 1 E", "AGRIMAX TERIS 1"). Srednica felgi
// (druga liczba) zostaje \d{1,3} — realne felgi <100 cali.
const SIZE_PATTERN = /\d{1,4}(?:[,.]\d{1,2})?(?:\s*\/\s*\d{0,3}(?:[,.]\d{1,2})?)?\s*L?[xXRL-]\s*\d{1,3}(?:[,.]\d{1,2})?(?:-\d{1,3}(?:[,.]\d{1,2})?)?/g;

/**
 * Rozbija pełną nazwę handlową Agrorami (BKT) na komponenty.
 * @param {string} fullName np. "Opona BKT AGRIMAX RT 855 E TL 520/85R38 / 20,8R38 (170A8/B)"
 * @returns {{model:string, tlTt:string|null, rozmiar:string|null, rozmiarAlt:string|null, liSi:string|null, pr:string|null, tech:string[]}}
 */
function parseAgroramiName(fullName) {
  let s = String(fullName || '');

  // Usuń prefiks "Opona " i markę "BKT" (marka jest już ustawiana osobno na stałe)
  s = s.replace(/^\s*Opona\s+/i, '').trim();
  s = s.replace(/\bBKT\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // 1) LI/SI: pierwszy wzorzec \d{2,3}<litera indeksu ISO>\d?(/\d{0,3}<litera>\d?)? — zwykle w
  //    nawiasach na końcu, ale bierzemy pierwsze trafienie gdziekolwiek w tekście (po usunięciu BKT).
  //    Zakres liter [ABCDEFGJKMNPQSTUVWY] = skala indeksów prędkości ISO/ETRTO, z WYłąCZENIEM
  //    liter X/R/L/H — to separatory rozmiaru w tym formacie nazw (np. "18X7-8", "375/70R20",
  //    "17,5LR24") i muszą zostać nietknięte, inaczej fragment rozmiaru zostanie błędnie wycięty.
  // POPRAWKA 2026-07-10: normalizeAgrorami() oczekuje `nosnosc` i `predkosc` jako
  // OSOBNE pola (tak jak dawał stary CSV: nosnosc="148/144", predkosc="A8/B"), a NIE
  // jednego połączonego stringa "148A8/144B" — zweryfikowane na testach jednostkowych
  // (test_tyres.cjs, sekcja "MO9 Agrorami"). Rozbijamy tu na cyfrową część (nosnosc)
  // i literowo-cyfrową część (predkosc) z tego samego dopasowania.
  let liSi = null;
  let nosnosc = null;
  let predkosc = null;
  {
    // POPRAWKA 2026-07-21 (anomalia 3: model "...FL 693M" bledenie brany za indeks 693/M,
    // przez co model wychodzil "Ridemax FL 182D" a prawdziwy indeks "(182D)" zostawal).
    // W formacie Agrorami PRAWDZIWY indeks LI/SI jest ZAWSZE w nawiasach na koncu, np.
    // "(182D)", "(170A8/B)". Numery w nazwie modelu ("693M", "527", "955") NIE sa w nawiasach.
    // Dlatego NAJPIERW szukamy indeksu W NAWIASACH; dopiero gdy go nie ma, fallback do
    // pierwszego trafienia bez nawiasow (zachowanie jak dotad, dla nazw bez nawiasow).
    const idxCore = '(\\d{2,3}[ABCDEFGJKMNPQSTUVWY]\\d?(?:\\/\\d{0,3}[ABCDEFGJKMNPQSTUVWY]\\d?)?)';
    const m = s.match(new RegExp('\\(\\s*' + idxCore + '\\s*\\)'))
           || s.match(new RegExp('\\(?\\b' + idxCore + '\\b\\)?'));
    if (m) {
      liSi = m[1];
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      // Rozbij na pary (nosnosc, predkosc) UZYWAJAC TEJ SAMEJ LOGIKI co produkcyjny
      // parseLoadSpeed() w tyre_params.cjs (regex (\d{2,3})([A-Z]\d?) w petli) —
      // celowo identyczne zachowanie, wliczajac znane ograniczenie: skrocony zapis
      // "170A8/B" (jedna nosnosc, druga predkosc bez wlasnego numeru) zwraca tylko
      // "170"/"A8" — to samo ograniczenie ma juz produkcyjny parseLoadSpeed, wiec
      // zachowanie jest w 100% zgodne z reszta systemu (nie gorsze, nie lepsze).
      // POPRAWKA 2026-07-15: notacja skrocona typu "146A8/B" (jedna nosnosc + DWA
      // warianty predkosci dla montazu single/dual — standard w oponach przemyslowych
      // BKT) wczesniej gubila druga litere ("/B") bo pairRe wymaga cyfry PRZED litera.
      // Teraz: po znalezieniu par nosnosc+predkosc, sprawdzamy czy PO OSTATNIEJ parze
      // zostala "osierocona" litera predkosci ("/X" lub "/X#", bez wlasnej cyfry
      // nosnosci) — jesli tak, dolaczamy ja jako dodatkowy wariant predkosci dla TEJ
      // SAMEJ (ostatniej) nosnosci, zamiast ja gubic. Przyklad: "146A8/B" -> nosnosc
      // "146", predkosc "A8/B" (bylo: predkosc "A8", "/B" utracone).
      const pairRe = /(\d{2,3})([A-Z]\d?)/gi;
      const loads = [];
      const speeds = [];
      let pm;
      let lastPairEnd = 0;
      while ((pm = pairRe.exec(liSi)) !== null) {
        loads.push(pm[1]);
        speeds.push(pm[2].toUpperCase());
        lastPairEnd = pm.index + pm[0].length;
      }
      if (loads.length) {
        const trailing = liSi.slice(lastPairEnd);
        const orphanMatch = trailing.match(/^\/([A-Z]\d?)\b/i);
        if (orphanMatch) {
          speeds[speeds.length - 1] = speeds[speeds.length - 1] + '/' + orphanMatch[1].toUpperCase();
        }
        nosnosc = loads.join('/');
        predkosc = speeds.join('/');
      }
    }
  }

  // 2) Markery technologii (IF/VF/IND/CHO/CFO/NRO) jako osobne tokeny — zachowujemy
  //    do listy `tech`, ale usuwamy z tekstu żeby nie zaśmiecały modelu.
  const tech = [];
  s = s
    .split(' ')
    .filter(tok => {
      const clean = tok.replace(/[()]/g, '');
      if (TECH_MARKERS.includes(clean.toUpperCase())) {
        tech.push(clean.toUpperCase());
        return false;
      }
      return true;
    })
    .join(' ');

  // 3) PR (płótna): liczba + "PR" (z opcjonalnym "/" przed i "pr." śmieciem po)
  let pr = null;
  {
    const m = s.match(/\/?\s*(\d{1,2})\s*PR\b\.?/i);
    if (m) {
      pr = m[1];
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    }
  }
  s = s.replace(/\bpr\.\s*/gi, ' ');

  // 4) TL/TT
  let tlTt = null;
  {
    const m = s.match(/\b(TL|TT)\b/);
    if (m) {
      tlTt = m[1];
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    }
  }
  s = s.replace(/\s+/g, ' ').trim();

  // 5) Rozmiar(y): może być główny + alternatywny (np. "520/85R38 / 20,8R38")
  // POPRAWKA 2026-07-16 (bug #4): SIZE_PATTERN dopuszcza separator "-" i "L" bez
  // wymogu przylegania do cyfry, co powoduje fałszywe dopasowania na modelach
  // przemysłowych BKT typu "EARTHMAX SR50 L-5**" — fragment "SR50" (numer modelu)
  // + sąsiadujące oznaczenie klasy "L-5" zlepia się w "50 L-5", które wygląda jak
  // rozmiar, ale NIE JEST prawdziwym zapisem rozmiaru opony (prawdziwe zapisy typu
  // "18X7-8" czy "375/70R20" nigdy nie mają spacji między pierwszą liczbą a
  // separatorem R/X/L). Potwierdzone na realnych danych API (2026-07-16): 6/6
  // przypadków ze spacją przed "L[-]cyfra" to fałszywe dopasowania z modelu, 0
  // przypadków to prawdziwy rozmiar w tym formacie. Fałszywe dopasowania są
  // przesuwane na koniec listy (nie usuwane — jeśli to JEDYNE dopasowanie, lepiej
  // mieć wątpliwy rozmiar niż żaden), żeby prawdziwy rozmiar (bez tej sygnatury)
  // zawsze wygrywał jako sizes[0] (główny rozmiar używany przez normalizeAgrorami).
  const FALSE_MODEL_SIZE_MATCH = /^\d{1,3}\s+L-?\d/i;
  const sizeMatches = [...s.matchAll(SIZE_PATTERN)]
    .sort((a, b) => {
      const aFalse = FALSE_MODEL_SIZE_MATCH.test(a[0].trim()) ? 1 : 0;
      const bFalse = FALSE_MODEL_SIZE_MATCH.test(b[0].trim()) ? 1 : 0;
      if (aFalse !== bFalse) return aFalse - bFalse;
      return a.index - b.index;
    });
  const sizes = sizeMatches.map(m => m[0].trim());
  // POPRAWKA 2026-07-16 (bug #4, część 2): fałszywe dopasowania (sygnatura
  // FALSE_MODEL_SIZE_MATCH) NIE są wycinane z tekstu — pochodzą z numeru modelu
  // (np. "50" w "SR50") zlepionego z sąsiadującym oznaczeniem klasy ("L-5"), więc
  // wycięcie ich z tekstu okradałoby model z tego numeru (dawałoby "EARTHMAX SR"
  // zamiast "EARTHMAX SR50"). Tylko PRAWDZIWE dopasowania rozmiaru są usuwane z
  // tekstu — fałszywe zostają na miejscu i trafiają do modelu tak, jak były w
  // oryginalnej nazwie Agrorami.
  const matchesByIndexDesc = [...sizeMatches]
    .filter(m => !FALSE_MODEL_SIZE_MATCH.test(m[0].trim()))
    .sort((a, b) => b.index - a.index);
  for (const m of matchesByIndexDesc) {
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
  }
  s = s.replace(/\s+/g, ' ').trim();
  // POPRAWKA 2026-07-21 (anomalia 4: resztkowy przecinek po alt-rozmiarze, np.
  // "MAGLIFT STD 8,15X15 (28X9-15, 225/75-15) /7.0" -> po wycieciu rozmiarow z nawiasu
  // zostawal osamotniony "," w modelu ("MAGLIFT STD ,"). Dokladamy przecinek do znakow
  // czyszczonych po ekstrakcji rozmiaru — przecinek nigdy nie nalezy do nazwy modelu.
  s = s.replace(/[(),/]/g, ' ').replace(/\s+/g, ' ').trim();

  // POPRAWKA 2026-07-16 (bug #5): usun dopisek "lesna/lesne" i znak cala (") z modelu
  s = s.replace(/\ble[sś]n[ae]\b/gi, ' ');
  s = s.replace(/"/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  // POPRAWKA 2026-07-21 (bug bieznik: NOWOSC/Zam./WZM zdupl./L-E klasa, zgloszenie Anny,
  // zrzuty ekranu panelu): dostawca Agrorami wpisuje w nazwie handlowej dopiski
  // marketingowo-techniczne, ktore po odjeciu rozmiaru/LI-SI/PR/TL zostaja bledenie w
  // modelu/biezniku:
  //  - "NOWOSC" (np. "V-FLEXA NOWOSC") -> usuwamy calkowicie, to tylko oznaczenie
  //    marketingowe "nowy produkt", bez wartosci technicznej dla katalogu.
  //  - "Zam." (skrot, prawdopodobnie "zamiennik"/"zamowienie") -> usuwamy calkowicie,
  //    w tym przypadki zdublowane w oryginalnej nazwie ("TR 315 Zam. Zam.").
  //  - "WZM" (prawdopodobnie "wzmocniony/wzmocnione") -> dostawca czasem dubluje ten
  //    dopisek w nazwie handlowej (nawiasy w dwoch miejscach, np. "FLOT 648 T (WZM) ...
  //    T E TL (WZM)") - zachowujemy JEDNO wystapienie (decyzja Anny), usuwamy duplikaty.
  // UWAGA: \b (granica slowa) w JS regex jest ASCII-only i NIE rozpoznaje polskich liter
  // (S/C z ogonkiem) jako liter — \bNOWO[SŚ][CĆ]\b nigdy sie nie dopasowywalo (zweryfikowane
  // testem). Uzywamy lookaround na spacje/granice stringa zamiast \b dla tokenow z polskimi
  // znakami.
  s = s.replace(/(^|\s)NOWO[SŚ][CĆ](?=\s|$)/gi, '$1');
  s = s.replace(/(^|\s)Zam\.?(?=\s|$)/gi, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  {
    let seenWzm = false;
    s = s.split(' ').filter(tok => {
      if (/^WZM$/i.test(tok)) {
        if (seenWzm) return false;
        seenWzm = true;
      }
      return true;
    }).join(' ');
  }
  s = s.replace(/\s+/g, ' ').trim();

  // POPRAWKA 2026-07-21 (bug bieznik, dalszy ciag): oznaczenie klasy bieznika przemyslowego
  // (L/E/G/R/C/I + cyfra 1-5, opcjonalny myslnik, opcjonalne 1-2 gwiazdki, czasem DWA
  // oznaczenia naraz np. "L3* E3**") NIE jest czescia nazwy modelu (np. "EARTHMAX SR31
  // L3* E3**" -> model to "EARTHMAX SR31", "L3*"/"E3**" to osobne oznaczenie klasy) -
  // analogicznie do TREAD_PATTERN_RE juz uzywanego dla Handlopex (tyre_params.cjs), ale
  // rozszerzone o warianty bez myslnika i z gwiazdkami. WAZNE (regresja znaleziona testem):
  // ograniczamy ekstrakcje WYLACZNIE do modeli EARTHMAX SR.../LOADER SPL/LOADER PLUS —
  // zweryfikowane, ze wszystkie 25 zgloszonych przypadkow naleza do tej grupy. Bez tego
  // ograniczenia regex falszywie lapal np. "E 1" w "AGRIMAX RT 600 E 1", ktore jest
  // INTEGRALNA czescia nazwy modelu (potwierdzone wczesniej w tej samej sesji przy
  // podobnej analizie MAGLIFT/LIFTMAX), nie oznaczeniem klasy bieznika. Wyciagamy do
  // osobnego pola oznaczenieBieznika, ktore adapter.cjs juz mapuje do kolumny
  // products.oznaczenie_bieznika (ten sam mechanizm co dla Handlopex).
  const treadClassTokens = [];
  const isOtrModelForTreadClass = /\bEARTH\s?MAX\s+SR|\bLOADER\s+(SPL|PLUS)\b/i.test(s);
  if (isOtrModelForTreadClass) {
    const TREAD_CLASS_RE = /\b([LEGRCI])(-)?([1-5])(\*{1,2})?(?!\*|[0-9])/gi;
    s = s.replace(TREAD_CLASS_RE, (match, letter, hyphen, digit, stars) => {
      treadClassTokens.push(`${letter.toUpperCase()}${digit}${stars || ''}`);
      return ' ';
    });
    s = s.replace(/\s+/g, ' ').trim();
  }
  const oznaczenieBieznika = treadClassTokens.length ? treadClassTokens.join(' ') : null;

  // POPRAWKA 2026-07-21 (bug MAGLIFT): dostawca Agrorami dopisuje na koncu nazwy
  // wozkowych opon BKT MAGLIFT/LIFTMAX samotna liczbe = szerokosc felgi w calach
  // (np. "MAGLIFT STD 16X6-8 4.33" -> po usunieciu rozmiaru "16X6-8" zostaje
  // "MAGLIFT STD 4.33"). Ta liczba NIE ma separatora x/R/L, wiec SIZE_PATTERN jej
  // nie wycina, i trafia bledenie do modelu/biegnika (bug zgloszony przez Anne
  // 2026-07-21, zrzut ekranu panelu: "MAGLIFT LIP NIEBRUDZACA 8.00" itd. — 45
  // rekordow MO9). WAZNE: ograniczone WYLACZNIE do linii MAGLIFT/LIFTMAX, bo inne
  // modele BKT (np. "EARTHMAX SR 33", "AW 09", "BK-LOADER 53", "AGRIMAX TERIS 1")
  // maja PRAWDZIWA liczbe jako czesc nazwy modelu na koncu — potwierdzone na 6
  // realnych przypadkach z katalogu (2026-07-21), gdzie ogolny regex bez tego
  // ograniczenia bledenie obcinalby poprawne nazwy modeli.
  if (/^(maglift|liftmax|lift\s*max)\b/i.test(s)) {
    s = s.replace(/\s+\d{1,2}([.,]\d{1,2})?\s*$/, ' ').trim();
    s = s.replace(/\s+/g, ' ').trim();
  }

  // POPRAWKA 2026-07-21 (bug bieznik: indeks nosnosci/predkosci zostaje w modelu, zgloszenie Anny):
  // helper rozbijajacy string LI/SI ("131A8/B", "164A8") na pola nosnosc/predkosc TA SAMA
  // logika co glowny ekstraktor w kroku 1 (pairRe + obsluga osieroconej predkosci "/B").
  const splitLiSi = (raw) => {
    const pairRe = /(\d{2,3})([A-Z]\d?)/gi;
    const loads = [];
    const speeds = [];
    let pm;
    let lastPairEnd = 0;
    while ((pm = pairRe.exec(raw)) !== null) {
      loads.push(pm[1]);
      speeds.push(pm[2].toUpperCase());
      lastPairEnd = pm.index + pm[0].length;
    }
    if (!loads.length) return null;
    const orphan = raw.slice(lastPairEnd).match(/^\/([A-Z]\d?)\b/i);
    if (orphan) speeds[speeds.length - 1] = speeds[speeds.length - 1] + '/' + orphan[1].toUpperCase();
    return { nosnosc: loads.join('/'), predkosc: speeds.join('/') };
  };

  // POPRAWKA 2026-07-21 (bug bieznik, przypadek 1: LI/SI SKLEJONE z litera modelu, np.
  // "AGRIMAX RT955 E131A8/B" — litera "E" konczy nazwe modelu, a "131A8/B" to indeks).
  // Glowny ekstraktor (krok 1) wymaga granicy slowa \b PRZED cyframi LI/SI, ktora NIE
  // wystepuje gdy indeks jest doklejony bezposrednio do litery (E i 1 to oba znaki slowa).
  // Fizycznie: gdy nosnosc dotad NIE zostala znaleziona, szukamy w modelu wzorca
  // <litera><LI/SI> na koncu tokenu i wycinamy TYLKO czesc LI/SI, ZOSTAWIAJAC litere
  // (nalezy do nazwy modelu, np. "...RT955 E"). Ograniczone do przypadku gdy nosnosc==null,
  // wiec nie koliduje z rekordami majacymi juz poprawny LI/SI z kroku 1.
  if (!nosnosc) {
    // UWAGA: wczesniejszy krok (linia ~182) zamienil juz "/" na spacje, wiec skrocony zapis
    // "131A8/B" dociera tu jako "131A8 B" (osierocona predkosc rozdzielona spacja). Dlatego
    // po sklejonym rdzeniu LI/SI dopuszczamy opcjonalna osierocona predkosc "<spacja><litera><cyfra?>".
    const glued = s.match(/([A-Za-z])(\d{2,3}[A-Z]\d?)(?:\s+([A-Z]\d?)(?![A-Za-z]))?\b/);
    if (glued) {
      const core = glued[2] + (glued[3] ? '/' + glued[3] : '');
      const parsed = splitLiSi(core);
      if (parsed) {
        nosnosc = parsed.nosnosc;
        predkosc = parsed.predkosc;
        liSi = core;
        // zostaw litere (glued[1]), usun caly dopasowany indeks (rdzen + ewentualna osierocona predkosc)
        s = s.slice(0, glued.index + 1) + ' ' + s.slice(glued.index + glued[0].length);
        s = s.replace(/\s+/g, ' ').trim();
      }
    }
  }

  // POPRAWKA 2026-07-21 (bug bieznik, przypadek 2: LI/SI ZDUBLOWANE w nazwie handlowej, np.
  // "MULTIMAX MP 527 164 B 164A8" — dostawca wpisuje indeks dwukrotnie: raz w formie
  // rozdzielonej spacja "164 B", raz sklejonej "164A8"). Krok 1 poprawnie bierze forme
  // sklejona ("164A8"), ale forma rozdzielona spacja ("164 B") zostaje w modelu jako smiec.
  // Gdy nosnosc jest juz znana, usuwamy z modelu pozostaly fragment "<ta_sama_nosnosc>
  // <litera-predkosci>" (z opcjonalna cyfra), ograniczony do WARTOSCI rowej znalezionemu
  // indeksowi — nie ruszamy innych liczb w nazwie modelu.
  if (nosnosc) {
    for (const li of String(nosnosc).split('/')) {
      if (!/^\d{2,3}$/.test(li)) continue;
      const dupRe = new RegExp(`\\b${li}\\s+[A-Z]\\d?\\b`, 'g');
      s = s.replace(dupRe, ' ');
    }
    s = s.replace(/\s+/g, ' ').trim();
  }

  // POPRAWKA 2026-07-21 (anomalia 2: LI/SI ZDUBLOWANE w formie SKLEJONEJ, np.
  // "AGRIMAX V-FLECTO E 173D 173D" albo "LIFT MAX LM81 146A5 146A5"). Krok 1 poprawnie
  // wyluskal indeks (nosnosc/predkosc), ale identyczna sklejona kopia "<load><speed>"
  // zostaje w modelu jako smiec. Gdy nosnosc jest znana, usuwamy z modelu WSZYSTKIE
  // sklejone tokeny "<ta_sama_nosnosc><litera-predkosci>" (z opcjonalna cyfra), ograniczone
  // do WARTOSCI rownej znalezionemu indeksowi — nie ruszamy innych liczb w nazwie modelu.
  if (nosnosc) {
    const loads = String(nosnosc).split('/').filter(li => /^\d{2,3}$/.test(li));
    for (const li of loads) {
      const gluedDupRe = new RegExp(`\\b${li}[A-Z]\\d?(?:\\/[A-Z0-9]{1,4})?\\b`, 'g');
      s = s.replace(gluedDupRe, ' ');
    }
    s = s.replace(/\s+/g, ' ').trim();
  }

  const model = s.replace(/^[-\s]+|[-\s]+$/g, '').trim();

  return {
    model: model || null,
    tlTt: tlTt || null,
    rozmiar: sizes[0] || null,
    rozmiarAlt: sizes[1] || null,
    liSi: liSi || null,       // string surowy, do debugowania/logow (nieuzywany bezposrednio przez normalizeAgrorami)
    nosnosc: nosnosc || null, // np. "170" albo "148/144" — pole zgodne z kontraktem normalizeAgrorami
    predkosc: predkosc || null, // np. "A8" albo "A8/B"
    pr: pr || null,
    tech,
    // POPRAWKA 2026-07-21 (bug bieznik): oznaczenie klasy L/E/G/R/C/I+cyfra wyciagniete
    // z modelu do osobnego pola, patrz komentarz przy TREAD_CLASS_RE powyzej.
    oznaczenieBieznika: oznaczenieBieznika || null
  };
}


const DOSTAWCA = 'MO9_Agrorami';

const GRAPHQL_URL = process.env.AGRORAMI_GRAPHQL_URL || 'https://hurtownia.agrorami.pl/graphql?store=pl';
const CATEGORY_ID = process.env.AGRORAMI_CATEGORY_ID || '148'; // Opony BKT = 1113 szt.
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // odśwież 5 min przed wygaśnięciem
const TOKEN_TTL_MS = 55 * 60 * 1000;   // zakładamy ~1h, odświeżamy po 55 min

// ---- Mapowanie kategorii Agrorami → słownik Bridge (zgodne z mo9_agrorami.cjs) ----
const KATEGORIA_MAP = {
  'rolnicze': 'rolnicze',
  'leśne': 'leśne', 'lesne': 'leśne',
  'przemysłowe': 'przemysłowe', 'przemyslowe': 'przemysłowe',
  'ciężarowe': 'ciężarowe', 'ciezarowe': 'ciężarowe',
  'dętki': 'dętki', 'detki': 'dętki',
  'akcesoria': 'akcesoria',
  'inne': 'rolnicze' // DECYZJA ANNY: inne → rolnicze
};

// Override rozmiaru dla pozycji, gdzie dostawca wpisuje indeks zamiast wymiaru (jak w CSV parserze)
const ROZMIAR_OVERRIDE = {
  '106946': '540/65R38' // BKT AGRIMAX RT 657
};

// ---- Cache tokenu (per proces) ----
let _token = null;
let _tokenExp = 0;

function _creds() {
  const email = process.env.AGRORAMI_EMAIL;
  const password = process.env.AGRORAMI_PASSWORD;
  if (!email || !password) {
    throw new Error('Brak AGRORAMI_EMAIL / AGRORAMI_PASSWORD w .env');
  }
  return { email, password };
}

async function _gqlFetch(query, variables, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {
      throw new Error(`Agrorami: niepoprawny JSON (HTTP ${resp.status}): ${text.slice(0, 200)}`);
    }
    return { httpStatus: resp.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function _isAuthError(json, httpStatus) {
  if (httpStatus === 401) return true;
  const errs = (json && json.errors) || [];
  return errs.some(e => {
    const msg = (e && e.message ? String(e.message) : '').toLowerCase();
    const cat = (e && e.extensions && e.extensions.category ? String(e.extensions.category) : '').toLowerCase();
    return cat === 'graphql-authorization' ||
      msg.includes('unauthorized') || msg.includes('token') ||
      msg.includes('current customer') || msg.includes('not authorized');
  });
}

async function _generateToken() {
  const { email, password } = _creds();
  const mutation = `mutation($email:String!,$password:String!){generateCustomerToken(email:$email,password:$password){token}}`;
  const { httpStatus, json } = await _gqlFetch(mutation, { email, password }, null);
  const token = json && json.data && json.data.generateCustomerToken && json.data.generateCustomerToken.token;
  if (!token) {
    const err = json && json.errors ? JSON.stringify(json.errors).slice(0, 300) : `HTTP ${httpStatus}`;
    throw new Error(`Agrorami: nie udało się wygenerować tokenu: ${err}`);
  }
  _token = token;
  _tokenExp = Date.now() + TOKEN_TTL_MS;
  return token;
}

async function _getToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _token && now < (_tokenExp - TOKEN_BUFFER_MS)) return _token;
  return _generateToken();
}

// Zapytanie o produkty (keyset po entity_id). Filtr: kategoria + entity_id > kursor.
const PRODUCTS_QUERY = `
query($catId:String!,$after:String!,$pageSize:Int!){
  products(
    filter:{ category_id:{eq:$catId}, entity_id:{gt:$after} }
    sort:{ entity_id:ASC }
    pageSize:$pageSize
    currentPage:1
  ){
    total_count
    items{
      id
      sku
      name
      ean
      manufacturer
      url_key
      stock_status
      stock_availability{ in_stock in_stock_real }
      categories{ id name }
      price_range{
        minimum_price{
          regular_price{ value currency }
          final_price{ value }
          individual_price{ net gross currency }
        }
      }
      image{ url }
      ... on SimpleProduct{ weight }
    }
  }
}`;

// Pobiera WSZYSTKIE produkty z danej kategorii keyset-paginacją, z auto-odnową tokenu.
async function fetchAllItems() {
  let token = await _getToken();
  const items = [];
  let after = '0';
  let totalCount = null;
  let retriedAuth = false;

  for (let guard = 0; guard < 1000; guard++) {
    const { httpStatus, json } = await _gqlFetch(PRODUCTS_QUERY, { catId: CATEGORY_ID, after, pageSize: PAGE_SIZE }, token);

    if (_isAuthError(json, httpStatus)) {
      if (retriedAuth) throw new Error('Agrorami: powtórny błąd autoryzacji po odnowie tokenu');
      retriedAuth = true;
      token = await _getToken(true); // wymuś świeży token i spróbuj raz jeszcze
      continue;
    }
    retriedAuth = false;

    if (json.errors && (!json.data || !json.data.products)) {
      throw new Error(`Agrorami: błąd GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`);
    }
    const products = json.data.products;
    if (totalCount == null) totalCount = products.total_count;
    const batch = products.items || [];
    if (batch.length === 0) break;

    for (const it of batch) items.push(it);

    // keyset: następny kursor = id ostatniego elementu
    const lastId = batch[batch.length - 1].id;
    after = String(lastId);

    if (batch.length < PAGE_SIZE) break; // ostatnia strona
  }

  return { items, totalCount };
}

// ---- Transformacja pojedynczego item GraphQL → record (kształt jak mo9.parseFile) ----
function itemToRecord(it) {
  const idDostawcy = String(it.id != null ? it.id : '').trim();
  // NAPRAWIONE 2026-07-13: kod_dostawcy MUSI być z pola `sku` (kod handlowy dostawcy,
  // np. "49437"), NIE z pola `id` (wewnętrzny numeryczny identyfikator encji Magento,
  // np. "184174") — Anna zweryfikowała na żywo w panelu, że kolumna KOD-DOSTAWCY
  // pokazywała id encji zamiast sku. `idDostawcy` (Magento entity_id) jest zachowany
  // tylko do wewnętrznych celów (ROZMIAR_OVERRIDE, keyset paginacji, error logging).
  const skuDostawcy = String(it.sku != null ? it.sku : '').trim() || idDostawcy;

  // Nazwa produktu Agrorami w API to pole `name` (pełna nazwa handlowa),
  // np. "540/65R38 BKT AGRIMAX RT 657 147D/144E TL". W CSV rozbite na kolumny
  // (producent/bieznik/rozmiar/nosnosc/predkosc/tl-tt). Tu nie mamy tego rozbicia,
  // więc rozmiar próbujemy wyłuskać z nazwy (c.extractSize), a resztę zostawiamy
  // normalizatorowi (normalizeAgrorami parsuje rozmiar+marki z pól, a nazwa końcowa
  // i tak jest budowana od nowa). Producenta bierzemy z pola `manufacturer` jeśli jest.
  const fullName = (it.name || '').trim();
  // UWAGA (naprawione 2026-07-10): pole `manufacturer` z API Agrorami to LICZBOWE ID
  // atrybutu Magento (np. 15), NIE nazwa marki jako string — zweryfikowane na żywo:
  // wszystkie produkty w kategorii 148 ("Opony BKT") mają manufacturer=15 albo null.
  // Ten magazyn sprzedaje wyłącznie markę BKT, więc ustawiamy producenta na stałe.
  const producent = 'BKT';

  // POPRAWKA 2026-07-10: rozbijamy nazwę handlową na komponenty ODDZIELNIE
  // (model/rozmiar/LI-SI/PR/TL-TT), tak jak dawał stary CSV z rozbitymi kolumnami.
  // Wcześniejsze podejście (cała nazwa → surowe_pola.bieznik) powodowało, że
  // normalizeAgrorami() dublował markę/oznaczenia w nazwaKoncowa i źle wyłuskiwał
  // LI/SI z tekstu (fallback parseTechnicalMarks nie radzi sobie z tym formatem —
  // zweryfikowane: ~921/922 rekordów wychodziło z bezsensownym polem indeksy).
  // Zweryfikowane na całym katalogu (1113 poz., 2026-07-10): 100% ma wykrywalny
  // rozmiar, model wychodzi czysty (np. "AGRIMAX RT 855 E").
  const parsedName = parseAgroramiName(fullName);

  // rozmiar: override (przypadki gdzie dostawca wpisuje indeks zamiast wymiaru) → z nazwy
  let rozmiar = '';
  if (ROZMIAR_OVERRIDE[idDostawcy]) {
    rozmiar = ROZMIAR_OVERRIDE[idDostawcy];
  } else {
    rozmiar = parsedName.rozmiar || '';
  }

  // bieznik: TERAZ czysty model (bez rozmiaru/LI-SI/PR/TL) — to jest pole, które
  // normalizeAgrorami mapuje 1:1 na `model` i wstawia do nazwaKoncowa, więc MUSI
  // być czyste, inaczej dostajemy duplikację marki/oznaczeń w finalnej nazwie.
  const bieznik = parsedName.model || fullName; // fallback na całą nazwę gdyby parser nic nie znalazł

  // kategoria: z drzewa kategorii API (nazwy). Mapujemy na słownik Bridge; fallback po nazwie.
  const catNames = Array.isArray(it.categories) ? it.categories.map(x => (x && x.name ? String(x.name).toLowerCase().trim() : '')).filter(Boolean) : [];
  let kategoriaRaw = '';
  for (const cn of catNames) {
    if (KATEGORIA_MAP[cn]) { kategoriaRaw = cn; break; }
    if (/rolnicz/.test(cn)) { kategoriaRaw = 'rolnicze'; break; }
    if (/przemys/.test(cn)) { kategoriaRaw = 'przemysłowe'; break; }
    if (/le[sś]n/.test(cn)) { kategoriaRaw = 'leśne'; break; }
    if (/ci[eę][zż]ar/.test(cn)) { kategoriaRaw = 'ciężarowe'; break; }
  }
  let kategoria = KATEGORIA_MAP[kategoriaRaw] || null;
  if (!kategoria) {
    kategoria = c.classifyByName(fullName);
  }
  // Override FLOT/Flotation (zgodnie z CSV parserem)
  if (kategoria === 'leśne' && /\bFLOT\b|Flotation|Flotmaster/i.test(fullName)) {
    kategoria = 'rolnicze';
  }

  // STAN: in_stock_real → magazyn (string, np. "5+"). null → null.
  const sa = it.stock_availability || {};
  const inStockReal = (sa.in_stock_real === null || sa.in_stock_real === undefined) ? '' : String(sa.in_stock_real);

  // CENA ZAKUPU: individual_price.net (cena indywidualna netto kontrahenta) →
  // fallback do final/regular jeśli brak individual.
  const minp = it.price_range && it.price_range.minimum_price ? it.price_range.minimum_price : {};
  const indiv = minp.individual_price || {};
  const cena = (indiv.net != null) ? indiv.net
    : (minp.final_price && minp.final_price.value != null) ? minp.final_price.value
    : (minp.regular_price && minp.regular_price.value != null) ? minp.regular_price.value
    : '';

  const ean = it.ean != null ? String(it.ean) : '';
  const waga = it.weight != null ? it.weight : '';
  const imageUrl = it.image && it.image.url ? it.image.url : '';

  // surowe_pola: KLUCZE muszą pasować do adapter→normalizeAgrorami (raw.*)
  const surowe = {
    id: idDostawcy,
    sku: it.sku != null ? String(it.sku) : '',
    ean: ean,
    producent: producent,
    bieznik: bieznik,        // czysty model (bez rozmiaru/LI-SI/PR/TL) — patrz parseAgroramiName
    rozmiar: rozmiar,        // wykryty z nazwy lub override
    // POPRAWKA 2026-07-10 (v2, po analizie test_tyres.cjs): normalizeAgrorami() ma
    // KONTRAKT z OSOBNYMI polami nosnosc (cyfry, np. "148/144") i predkosc (litery,
    // np. "A8/B") — tak jak dawał stary CSV. Przekazanie polaczonego stringa do
    // samego `nosnosc` (v1 tej poprawki) psuło wynik ("170A8/BA8" zamiast "170A8").
    // parseAgroramiName() teraz sam rozbija LI/SI na dwa pola tą samą logiką co
    // produkcyjny parseLoadSpeed() — więc tu już nie trzeba nic dodatkowo parsować.
    nosnosc: parsedName.nosnosc || '',   // np. "170" albo "148/144"
    predkosc: parsedName.predkosc || '', // np. "A8" albo "A8/B"
    'tl/tt': parsedName.tlTt || '',    // wyłuskane niezależnie od pozycji w nazwie
    plotna: parsedName.pr || '',       // PR — wyłuskane niezależnie od pozycji w nazwie
    cena: cena === '' ? '' : String(cena),
    magazyn: inStockReal,    // <-- in_stock_real; "5+" → normalizeQty → 5
    waga: waga === '' ? '' : String(waga),
    kategoria: kategoriaRaw || (kategoria || ''),
    sezon: '',
    // pola pomocnicze (nie czytane przez normalizeAgrorami, ale zachowane w snapshot):
    url_key: it.url_key || '',
    stock_status: it.stock_status || '',
    in_stock: (sa.in_stock === null || sa.in_stock === undefined) ? '' : String(sa.in_stock),
    in_stock_real: inStockReal,
    image_url: imageUrl,
    name_api: fullName,
    // POPRAWKA 2026-07-21 (bug bieznik): oznaczenie klasy L/E/G/R/C/I+cyfra wyciagniete
    // z modelu przez parseAgroramiName - patrz TREAD_CLASS_RE. Odczytywane w adapter.cjs
    // (raw.oznaczenie_bieznika_api) i przekazywane do normalizeAgrorami.
    oznaczenie_bieznika_api: parsedName.oznaczenieBieznika || ''
  };

  const sizeFromName = c.extractSize(fullName);
  const oznaczenia = [...new Set(c.extractTechnicalMarks(fullName))].filter(Boolean);

  return c.normalizeRecord({
    ean: c.normalizeEan(ean),
    kod_dostawcy: skuDostawcy,
    nazwa: fullName,
    producent: producent,
    model_bieznik: bieznik,
    rozmiar: rozmiar || (sizeFromName && sizeFromName.rozmiar) || '',
    rozmiar_alternatywny: (sizeFromName && sizeFromName.alternatywny) || '',
    cena_zakupu: cena,
    stan_magazynowy: inStockReal,   // "5+" — normalizeRecord → normalizeQty → 5
    kategoria: kategoria,
    oznaczenia_techniczne: oznaczenia,
    dostawca: DOSTAWCA,
    link_zdjecia: imageUrl,
    surowe_pola: surowe
  });
}

// Główna funkcja: pobiera z API i zwraca kształt identyczny jak mo9.parseFile.
// Zwraca { records, errors, odrzucone, dostawca, totalCount }.
async function fetchAll() {
  const { items, totalCount } = await fetchAllItems();
  const records = [];
  const errors = [];
  const odrzucone = [];

  for (const it of items) {
    try {
      // Odrzucamy quady (jak w CSV parserze) — po nazwie/kategorii
      const nameL = (it.name || '').toLowerCase();
      const catL = (Array.isArray(it.categories) ? it.categories.map(x => (x && x.name) || '').join(' ') : '').toLowerCase();
      if (/\bquad\b/.test(nameL) || /\bquad\b/.test(catL)) {
        odrzucone.push({ powod: 'quad', id: it.id, name: it.name });
        continue;
      }
      records.push(itemToRecord(it));
    } catch (e) {
      errors.push({ id: it && it.id, name: it && it.name, error: e.message });
    }
  }

  return { records, errors, odrzucone, dostawca: DOSTAWCA, totalCount };
}

module.exports = { fetchAll, fetchAllItems, itemToRecord, DOSTAWCA, _getToken };
