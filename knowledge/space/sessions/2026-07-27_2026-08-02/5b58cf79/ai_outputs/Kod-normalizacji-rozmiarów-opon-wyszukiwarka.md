# Kod: Normalizacja rozmiarów opon w wyszukiwarce Selly

**Data przygotowania:** 2026-07-30
**Status:** DO WDROŻENIA PÓŹNIEJ — przerwa techniczna
**Miejsce wdrożenia:** Panel Selly → Wygląd → Szablony graficzne → **D02. Stopka**

## Cel

Debiloodporne wyszukiwanie rozmiarów opon niezależnie od formatu wpisu użytkownika. Klient może wpisać rozmiar w dowolnej formie (bez separatorów, z `x`, ze spacjami, jednym ciągiem cyfr), a skrypt zamieni go **przy submit (Enter/lupa)** na format zaindeksowany w bazie Selly.

## Jak działa

1. Klient pisze w polu wyszukiwarki dowolnie — **skrypt NIC nie robi w trakcie pisania** (koniec chaosu z Firefox i innymi przeglądarkami)
2. Live search Selly pokazuje sugestie natywnie na tekst klienta
3. Dopiero **na Enter / kliknięciu lupy** skrypt przechwytuje submit
4. Normalizuje wpis do formatu jak w bazie (`650/65R42`, `18x8.50-8`, `18.4-38`)
5. Formularz wysyła się z poprawnym `q=`
6. Strona wyników pokazuje trafne produkty

## Obsługiwane formaty

### Radialne opony (mm)

| Klient wpisuje | Skrypt zamieni na |
|---|---|
| `650/65R42` | (bez zmian) |
| `65065R42` | `650/65R42` |
| `65065r25` | `650/65R25` |
| `6506542` | `650/65R42` |
| `650 65 42` | `650/65R42` |
| `1050/50R32` | (bez zmian) |
| `1050 50 32` | `1050/50R32` |

### Diagonalne (calowe, bez profilu)

| Klient wpisuje | Skrypt zamieni na |
|---|---|
| `18.4-38` | (bez zmian) |
| `18.438` | `18.4-38` |
| `18.4x38` | `18.4-38` |
| `10-16.5` | (bez zmian) |
| `10x16.5` | `10-16.5` |
| `10165` | `10-16.5` |

### ATV / gazonowe (3-częściowe z profilem calowym)

| Klient wpisuje | Skrypt zamieni na |
|---|---|
| `18x8.50-8` | (bez zmian) |
| `1885008` | `18x8.50-8` |
| `188508` | `18x8.50-8` |
| `25x10-12` | (bez zmian) |
| `251012` | `25x10-12` |

### Modele (spacje w kodach)

| Klient wpisuje | Skrypt zamieni na |
|---|---|
| `tm 3000` | `tm3000` |
| `rt 657` | `rt657` |

## Pełny kod do wklejenia w D02. Stopka

**Uwaga:** ZASTĘPUJE całą zawartość pliku D02. Stopka (Ctrl+A → Delete → wklej).

```html
<div class="container-bottom">
    <div class="box-bottom">
        <div class="box-bottom__title">{#@Konto#}</div>
        <div class="box-bottom__content">
            {#renderMenu:konto#}
        </div>
    </div>
    <div class="box-bottom">
        <div class="box-bottom__title">{#@Pomoc#}</div>
        <div class="box-bottom__content">
            {#renderMenu:pomoc#}
        </div>
    </div>
    <div class="box-bottom">
        <div class="box-bottom__title">{#@Informacje#}</div>
        <div class="box-bottom__content">
            {#renderMenu:informacje#}
        </div>
    </div>
    <div class="box-bottom">
        <div class="box-bottom__title">{#@Kontakt#}</div>
        <div class="box-bottom__content">
            <div class="footer-contact__cont">
                {#%SZYBKI_KONTAKT#}
            </div>
        </div>
    </div>
    <div class="box-bottom">
        <div class="box-bottom__title">{#%FIRMA_NAZWA#}</div>
        <div class="box-bottom__content">
            {#%SZYBKI_KONTAKT2#}
        </div>
    </div>
</div>

<script>
(function(){
  'use strict';

  var WIDTHS_RADIAL = [1250,1200,1150,1100,1050,1000,950,900,850,800,780,750,710,700,680,650,620,600,580,560,540,520,500,480,460,440,420,400,380,360,340,320,300,290,280,270,260,250,240,235,230,225,220,215,210,205,200,195,190,185,180,175,170,167,165,160,155,150,145,140,135,130,125,120,115,110,105,100];
  var PROFILES_RADIAL = [95,90,85,80,75,70,65,60,55,50,45,42,40,35,32,30,25,22];
  var WIDTHS_DIAGONAL = ['30.5','23.1','20.8','19.5','18.4','16.9','15.5','14.9','13.6','12.4','11.2','10.5','9.5','8.5','7.5','7.0','6.5','5.5','4.5','30','25','24','23','22','21','20','18','17','16','15','14','13','12','11','10','9','8','7','6','5'];
  var DIAMETERS = ['54','50','46','44','42','40','38','36','34','32','30','28','26','24.5','24','22.5','22','20','19.5','18','17.5','16.5','16','15','14','13','12','11.5','10','9','8','7','6'];
  var ATV_PROFILES = ['12.50','11.50','10.50','9.50','8.50','7.50','6.50','5.50','4.50','3.50','9.5','8.5','7.5','6.5','5.5','4.5','3.5','12','11','10','9','8','7','6','5','4','3'];

  function tryRadial(str){
    for(var i=0; i<WIDTHS_RADIAL.length; i++){
      var w = String(WIDTHS_RADIAL[i]);
      if(str.indexOf(w) === 0){
        var rest = str.substring(w.length);
        for(var j=0; j<PROFILES_RADIAL.length; j++){
          var p = String(PROFILES_RADIAL[j]);
          if(rest.indexOf(p) === 0){
            var diam = rest.substring(p.length);
            if(!diam) continue;
            for(var k=0; k<DIAMETERS.length; k++){
              if(diam === String(DIAMETERS[k]).replace('.','')){
                return {type:'radial', width:w, profile:p, diameter:String(DIAMETERS[k])};
              }
              if(diam === String(DIAMETERS[k])){
                return {type:'radial', width:w, profile:p, diameter:String(DIAMETERS[k])};
              }
            }
            if(/^\d{1,2}(\.\d)?$/.test(diam)){
              return {type:'radial', width:w, profile:p, diameter:diam};
            }
          }
        }
      }
    }
    return null;
  }

  function tryAtv(str){
    for(var i=0; i<WIDTHS_DIAGONAL.length; i++){
      var w = String(WIDTHS_DIAGONAL[i]);
      var wCompact = w.replace('.','');
      var prefixes = [w, wCompact];
      for(var pi=0; pi<prefixes.length; pi++){
        var pfx = prefixes[pi];
        if(str.indexOf(pfx) === 0){
          var rest = str.substring(pfx.length);
          if(!rest) continue;
          for(var pp=0; pp<ATV_PROFILES.length; pp++){
            var atvP = String(ATV_PROFILES[pp]);
            var atvPCompact = atvP.replace('.','');
            var atvPrefixes = [atvP, atvPCompact];
            for(var ap=0; ap<atvPrefixes.length; ap++){
              var apfx = atvPrefixes[ap];
              if(rest.indexOf(apfx) === 0){
                var diam = rest.substring(apfx.length);
                if(!diam) continue;
                for(var k=0; k<DIAMETERS.length; k++){
                  var d = String(DIAMETERS[k]);
                  var dCompact = d.replace('.','');
                  if(diam === d || diam === dCompact){
                    return {type:'atv', width:w, profile:atvP, diameter:d};
                  }
                }
                if(/^\d{1,3}(\.\d)?$/.test(diam)){
                  return {type:'atv', width:w, profile:atvP, diameter:diam};
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  function tryDiagonal(str){
    for(var i=0; i<WIDTHS_DIAGONAL.length; i++){
      var w = String(WIDTHS_DIAGONAL[i]);
      var wCompact = w.replace('.','');
      var prefixes = [w, wCompact];
      for(var pi=0; pi<prefixes.length; pi++){
        var pfx = prefixes[pi];
        if(str.indexOf(pfx) === 0){
          var rest = str.substring(pfx.length);
          if(!rest) continue;
          for(var k=0; k<DIAMETERS.length; k++){
            var d = String(DIAMETERS[k]);
            var dCompact = d.replace('.','');
            if(rest === d || rest === dCompact){
              return {type:'diagonal', width:w, diameter:d};
            }
          }
          if(/^\d{1,3}(\.\d)?$/.test(rest)){
            var formatted = rest;
            if(rest.length === 3 && rest.indexOf('.') === -1){
              formatted = rest.substring(0,2) + '.' + rest.substring(2);
            }
            return {type:'diagonal', width:w, diameter:formatted};
          }
        }
      }
    }
    return null;
  }

  function normalizeTireSize(raw){
    if(!raw) return raw;
    var input = String(raw).trim();
    if(!input) return raw;
    if(!/^[\d]/.test(input)) return raw;
    if(!/^[\d\s\/\\\-\.,xXRrEeZz]+$/.test(input)) return raw;

    var hasRadial = /[RrEeZz]/.test(input);
    var hasX = /[xX]/.test(input);

    if(hasRadial && hasX){
      hasX = false;
    }

    var groups = input.match(/\d+(?:\.\d+)?/g);
    if(!groups) return raw;

    if(groups.length === 3 && hasRadial){
      return groups[0] + '/' + groups[1] + 'R' + groups[2];
    }

    if(groups.length === 3 && hasX){
      return groups[0] + 'x' + groups[1] + '-' + groups[2];
    }

    if(groups.length === 3){
      var first = parseFloat(groups[0]);
      var hasDot = /\./.test(groups[0]) || /\./.test(groups[1]);
      if(first < 100 || hasDot){
        return groups[0] + 'x' + groups[1] + '-' + groups[2];
      }
      return groups[0] + '/' + groups[1] + 'R' + groups[2];
    }

    if(groups.length === 2 && hasRadial){
      var split = tryRadial(groups[0]);
      if(split){
        return split.width + '/' + split.profile + 'R' + groups[1];
      }
      return raw;
    }

    if(groups.length === 2 && hasX){
      return groups[0] + 'x' + groups[1];
    }

    if(groups.length === 2){
      if(/\./.test(groups[0]) || /\./.test(groups[1])){
        return groups[0] + '-' + groups[1];
      }
      var g2 = groups[1];
      if(g2.length === 3 && !/\./.test(g2)){
        var formatted = g2.substring(0,2) + '.' + g2.substring(2);
        return groups[0] + '-' + formatted;
      }
      return groups[0] + '-' + g2;
    }

    if(groups.length === 1){
      var g = groups[0];
      if(hasRadial || g.length >= 5){
        var split3 = tryRadial(g);
        if(split3){
          return split3.width + '/' + split3.profile + 'R' + split3.diameter;
        }
      }
      var splitAtv = tryAtv(g);
      if(splitAtv){
        return splitAtv.width + 'x' + splitAtv.profile + '-' + splitAtv.diameter;
      }
      var split4 = tryDiagonal(g);
      if(split4){
        return split4.width + '-' + split4.diameter;
      }
      return raw;
    }

    return raw;
  }

  function normalizeModelSpacing(raw){
    if(!raw) return raw;
    var input = String(raw).trim();
    if(!input) return raw;
    var result = input.replace(/([A-Za-zĄąĆćĘꣳŃńÓ󌜏źŻż])\s+(\d)/g, '$1$2');
    result = result.replace(/(\d)\s+([A-Za-zĄąĆćĘꣳŃńÓ󌜏źŻż])/g, '$1$2');
    return result;
  }

  function normalizeQuery(raw){
    if(!raw) return raw;
    var v = String(raw).trim();
    if(!v) return raw;
    if(/^\d/.test(v) && /^[\d\s\/\\\-\.,xXRrEeZz]+$/.test(v)){
      return normalizeTireSize(v);
    }
    return normalizeModelSpacing(v);
  }

  function attachToForm(form){
    if(!form || form.dataset.tireNormalizerAttached) return;
    form.dataset.tireNormalizerAttached = '1';

    form.addEventListener('submit', function(e){
      var input = form.querySelector('.header-search__query, input[name="q"], #query');
      if(!input) return;
      var normalized = normalizeQuery(input.value);
      if(normalized && normalized !== input.value){
        input.value = normalized;
      }
    }, true);
  }

  function init(){
    var forms = document.querySelectorAll('.header-search__form');
    forms.forEach(attachToForm);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
```

## Kroki wdrożenia (gdy skończy się przerwa techniczna)

1. Panel Selly → **Wygląd → Szablony graficzne → Edytor szablonu**
2. Otwórz **D02. Stopka**
3. **Zaznacz całą zawartość** (Ctrl+A) → **Delete**
4. **Wklej** kod powyżej (całość — 5 kolumn stopki + `<script>`)
5. **Zapisz**
6. **Konfiguracja → Cache → Wyczyść cache**
7. **Ctrl+Shift+R** w przeglądarce

## Testy po wdrożeniu (kolejno w Firefox / Chrome)

Wpisz każdy w wyszukiwarce, kliknij lupę, sprawdź wyniki:

- `65065r25` → oczekiwane wyniki dla `650/65R25`
- `1885008` → oczekiwane wyniki dla `18x8.50-8` (BKT SKID POWER HD)
- `18.438` → oczekiwane wyniki dla `18.4-38`
- `650 65 42` → oczekiwane wyniki dla `650/65R42` (26 produktów)

## Historia problemów rozwiązanych w tej wersji

- **Firefox „wrzucał znaki" podczas pisania** (`65065r25` → `650x65-25-r`) — naprawa: skrypt działa tylko przy submit, nie w trakcie pisania
- **MutationObserver duplikował event handlery** — usunięty
- **Priorytet R nad X** — jeśli w wpisie jest litera `R/r/E/e/Z/z`, wygrywa ścieżka radialna nawet gdy jest też `x`
- **Format ATV `18x8.50-8`** — dodana obsługa 3-częściowego formatu z profilem calowym
