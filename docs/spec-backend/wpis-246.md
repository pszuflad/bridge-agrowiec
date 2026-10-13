# Wpis 246 — podgląd kosztu przesyłki

`POST /api/partnerzy/geis/podglad-kosztu` `{partnerId, kraj, waga, dlugosc, szerokosc, wysokosc}` → `{zrodlo: "geis"|"stala-baza", wagaRozliczeniowa, progKg, baza, paliwoProc, paliwoEur, pakowanieGeisEur, mytoEur, pakowanieKrajuEur, razemEur}`; 400 z komunikatem przy braku tabeli/wagi/wymiarów, 404 dla nieznanego partnera. Liczy jak kalkulator ceny (`podglad-przesylki.ts` + `kosztPrzesylki`).
