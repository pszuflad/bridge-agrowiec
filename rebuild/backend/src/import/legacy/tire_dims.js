// Central tire dimension calculator — derives real height (cm) and tread width (cm)
// from the `rozmiar` string only (source of truth), per the company formula sheet.
//
// Formula sheet (Arkadiusz Mielczarek 23.02.2021):
//  - Metric slash  W/P R|B|- D : W in mm, P = profil %, D in inch.
//       sidewall_cm = (W_mm/10) * (P/100)
//       height_cm   = 2*sidewall_cm + D_inch*2.54
//  - No profil  W R|- D (W in inch): profil assumed 83%.
//       W_cm = W_inch*2.54 ; sidewall_cm = W_cm*0.83 ; height = 2*sidewall + D_inch*2.54
//  - Dash W-D where W>=60 => W is mm (e.g. 250-15): W_cm=W/10, profil 83% of that width.
//  - AxB-D : A = overall diameter, B = section width. If A,B >= 60 they are mm, else inch.
//       height_cm = A -> to cm ; width_cm = B -> to cm  (no profil math: A already the OD)
//
// Package dims (user rules, all values rounded UP to whole cm via Math.ceil):
//   dlugosc            = tire height (== real tire height, tire lies down; NO +15)
//   szerokosc_paczki   = tire tread width + 5   (packing margin)
//   wysokosc_przesylki = tire height + 15       (tire stands on a pallet in transit)
// Stored dimension columns WYSOKOSC and SZEROKOSC are also rounded UP to whole cm.

function round2(x){ return Math.round(x*100)/100; }
function ceilCm(x){ return Math.ceil(x - 1e-9); }  // round up to whole cm (epsilon guards float noise)
const toNum = s => parseFloat(String(s).replace(',','.'));

// returns {height_cm, width_cm, kind} or null if unparseable
function calcDims(rozmiar){
  if(!rozmiar) return null;
  let s=String(rozmiar).trim().toUpperCase();
  // strip leading VF/IF marker
  s=s.replace(/^(VF|IF)\s*/,'');

  // AxB-D  (e.g. 23x9-10, 690x180-15, 20x10.00-8)
  let m=s.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if(m){
    const A=toNum(m[1]), B=toNum(m[2]);
    const heightCm = A>=60 ? A/10 : A*2.54;   // A = overall diameter
    const widthCm  = B>=60 ? B/10 : B*2.54;   // B = section width
    return { height_cm: round2(heightCm), width_cm: round2(widthCm), kind:'axb' };
  }
  // 23x5  (AxB, no diameter) -> A overall dia, B width
  m=s.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)$/);
  if(m){
    const A=toNum(m[1]), B=toNum(m[2]);
    return { height_cm: round2(A>=60?A/10:A*2.54), width_cm: round2(B>=60?B/10:B*2.54), kind:'axb2' };
  }

  // Metric slash  W/P [R|B|L][-] D   (W mm, P %, D inch). Optional R/B/L marker + optional dash
  // handles 315/60R22.5, 400/45L-17.5, 12.5/80-18, 480/70R30
  m=s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[RBL]?\s*-?\s*(\d+(?:\.\d+)?)/);
  if(m){
    const W=toNum(m[1]), P=toNum(m[2]), D=toNum(m[3]);
    const widthCm = W>=60 ? W/10 : W*2.54;
    const sidewallCm = widthCm*(P/100);
    const heightCm = 2*sidewallCm + D*2.54;
    return { height_cm: round2(heightCm), width_cm: round2(widthCm), kind:'slash' };
  }

  // L-suffix bias  e.g. 30.5L-32, 28L-26, 17.5L-24  (W inch, L=bias, profil 83%)
  m=s.match(/^(\d+(?:\.\d+)?)\s*L\s*-\s*(\d+(?:\.\d+)?)/);
  if(m){
    const W=toNum(m[1]), D=toNum(m[2]);
    const widthCm = W>=60 ? W/10 : W*2.54;
    const sidewallCm = widthCm*0.83;
    const heightCm = 2*sidewallCm + D*2.54;
    return { height_cm: round2(heightCm), width_cm: round2(widthCm), kind:'lbias' };
  }

  // Simple  W [R|-] D   (no profil). W>=60 => mm else inch. profil 83%.
  m=s.match(/^(\d+(?:\.\d+)?)\s*[R-]\s*(\d+(?:\.\d+)?)/);
  if(m){
    const W=toNum(m[1]), D=toNum(m[2]);
    const widthCm = W>=60 ? W/10 : W*2.54;
    const sidewallCm = widthCm*0.83;
    const heightCm = 2*sidewallCm + D*2.54;
    return { height_cm: round2(heightCm), width_cm: round2(widthCm), kind:'simple' };
  }

  return null;
}

// Returns all 5 stored PACKAGE dimensions as whole-cm integers (rounded UP), or null.
// POPRAWKA 2026-07-14: te wartości sluza WYLACZNIE do pakowania/logistyki (karton/paleta).
// Realna szerokosc opony (w mm, bez zaokraglania do cm) jest zwracana OSOBNO przez
// tireWidthMm() nizej — nie miesza sie juz z tymi polami paczki.
function packageDims(rozmiar){
  const d=calcDims(rozmiar);
  if(!d) return null;
  const wysokosc = ceilCm(d.height_cm);   // wysokosc PACZKI (cm) = wysokosc opony w cm, w gore
  const szerokoscPaczkiCm = ceilCm(d.width_cm); // pomocnicze, cm w gore (baza szerokosci paczki)
  return {
    kind: d.kind,
    wysokosc,                                     // WYSOKOSC paczki (cm, int)
    szerokosc: szerokoscPaczkiCm,                 // (legacy, cm) — NIE uzywac jako szer. opony
    dlugosc: wysokosc,                            // DLUGOSC paczki = wysokosc opony (to samo)
    szerokosc_paczki: ceilCm(d.width_cm + 5),     // SZEROKOSC-PACZKI = szer. + 5 (cm)
    wysokosc_przesylki: ceilCm(d.height_cm + 15), // WYSOKOSC-PRZESYLKI = wys. + 15 (cm, paleta)
  };
}

// Rzeczywista szerokosc opony w mm, NIEzaokraglona do cm (dokladna wartosc techniczna).
// Wzor firmowy (Arkadiusz Mielczarek): notacja slash -> W juz w mm, uzyj bezposrednio;
// notacja calowa (bez ukosnika, W<60) -> W_cale * 25.4 = mm.
function tireWidthMm(rozmiar){
  const d=calcDims(rozmiar);
  if(!d) return null;
  return round2(d.width_cm*10);
}

module.exports={calcDims, packageDims, tireWidthMm, round2, ceilCm};
