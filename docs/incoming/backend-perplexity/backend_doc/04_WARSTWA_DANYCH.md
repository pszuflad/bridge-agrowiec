# 04. Warstwa danych `U`

`U` jest obiektem 50 metod (`/tmp/bridge_be/be.cjs:44698-45101`). Rdzeń rzeczywiście używa Drizzle: mapowania tabel oraz adapter BetterSQLite są obecne w deminifikacie (`/tmp/bridge_be/be.cjs:43700-43968`, `43969-44020`). Dlatego w kolumnie „operacja” przytoczono faktyczne wyrażenie Drizzle/SQL literal zamiast wymyślonego SQL.

| Metoda (argumenty) | Tabela | Operacja dokładnie z kodu | Źródło |
|---|---|---|---|
| `listProducts()` | products | `return X.select().from(he).all()` | `/tmp/bridge_be/be.cjs:44699` |
| `listProductsPaged(t = 200, e = 0, n)` | products | `let a = X.select().from(he).where(se(he.dostawca, n)).limit(t).offset(e).all(),`<br>`s = X.select({`<br>`let i = X.select().from(he).limit(t).offset(e).all(),`<br>`r = X.select({` | `/tmp/bridge_be/be.cjs:44702` |
| `getProduct(t)` | products | `return X.select().from(he).where(se(he.id, t)).get()` | `/tmp/bridge_be/be.cjs:44722` |
| `getProductByKod(t)` | products | `return X.select().from(he).where(se(he.kod, t)).get()` | `/tmp/bridge_be/be.cjs:44725` |
| `updateProduct(t, e)` | products | `return X.update(he).set(e).where(se(he.id, t)).run(), this.getProduct(t)` | `/tmp/bridge_be/be.cjs:44728` |
| `deleteProduct(t)` | products | `return this.getProduct(t) ? (X.delete(he).where(se(he.id, t)).run(), !0) : !1` | `/tmp/bridge_be/be.cjs:44740` |
| `clearProducts()` | products | `X.delete(he).run()` | `/tmp/bridge_be/be.cjs:44743` |
| `addProductsBulk(t)` | products, markups, promotions | `return Qi.transaction(i => {`<br>`let s = X.select().from(he).where(se(he.kod, a.kod)).get(),`<br>`const __mk = X.select().from(Bt).all(),`<br>`__pr = X.select().from(hn).all(),` | `/tmp/bridge_be/be.cjs:44746` |
| `listStaging()` | staging_items | `return X.select().from(He).all()` | `/tmp/bridge_be/be.cjs:44808` |
| `listStagingPaged(t = 200, e = 0)` | staging_items | `let n = X.select().from(He).limit(t).offset(e).all(),`<br>`i = X.select({` | `/tmp/bridge_be/be.cjs:44811` |
| `getStaging(t)` | staging_items | `return X.select().from(He).where(se(He.id, t)).get()` | `/tmp/bridge_be/be.cjs:44821` |
| `updateStaging(t, e)` | staging_items | `return X.update(He).set(e).where(se(He.id, t)).run(), this.getStaging(t)` | `/tmp/bridge_be/be.cjs:44824` |
| `acceptStaging(t, e)` | products, staging_items, markups, promotions | `let n = X.select().from(He).where(se(He.id, t)).get();`<br>`let c = X.select().from(he).where(se(he.kod, n.kod)).get();`<br>`c && X.update(he).set({`<br>`}).where(se(he.id, c.id)).run(), X.delete(He).where(se(He.id, t)).run();` | `/tmp/bridge_be/be.cjs:44827` |
| `rejectStaging(t)` | staging_items | `X.delete(He).where(se(He.id, t)).run()` | `/tmp/bridge_be/be.cjs:44917` |
| `clearStaging()` | staging_items | `X.delete(He).run()` | `/tmp/bridge_be/be.cjs:44920` |
| `addStaging(t)` | staging_items | `let _ex = X.select().from(He).where(A`kod = ${t.kod} AND typ_zmiany = ${t.typZmiany} AND COALESCE(powod,'') = COALESCE(${t.powod},'')`).get();`<br>`return X.insert(He).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:44923` |
| `listOverrides()` | manual_overrides | `return X.select().from(Yt).orderBy(Ii(Yt.createdAt)).all()` | `/tmp/bridge_be/be.cjs:44928` |
| `getOverridesFor(t, e)` | manual_overrides | `return X.select().from(Yt).where(A`supplier_kod = ${t} AND supplier_product_id = ${e}`).all()` | `/tmp/bridge_be/be.cjs:44931` |
| `upsertOverride(t)` | manual_overrides | `let e = X.select().from(Yt).where(A`supplier_kod = ${t.supplierKod} AND supplier_product_id = ${t.supplierProductId} AND field_name = ${t.fieldName}`).get();`<br>`return e ? (X.update(Yt).set({`<br>`}).where(se(Yt.id, e.id)).run(), X.select().from(Yt).where(se(Yt.id, e.id)).get()) : X.insert(Yt).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:44934` |
| `deleteOverride(t)` | manual_overrides | `let e = X.select().from(Yt).where(se(Yt.id, t)).get();`<br>`return e ? (X.delete(Yt).where(se(Yt.id, t)).run(), e) : null` | `/tmp/bridge_be/be.cjs:44947` |
| `listAlerts()` | alerts | `return X.select().from(Ki).orderBy(Ii(Ki.data)).all()` | `/tmp/bridge_be/be.cjs:44951` |
| `addAlert(t)` | alerts | `return X.insert(Ki).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:44954` |
| `updateAlertStatus(t, e)` | alerts | `X.update(Ki).set({` | `/tmp/bridge_be/be.cjs:44957` |
| `listHistory()` | history | `return X.select().from(Wa).orderBy(Ii(Wa.data)).all()` | `/tmp/bridge_be/be.cjs:44962` |
| `listMarkups()` | markups | `return X.select().from(Bt).all()` | `/tmp/bridge_be/be.cjs:44965` |
| `addMarkup(t)` | markups | `const r = X.insert(Bt).values(t).returning().get();`<br>`recalcPricesFromRules()` | `/tmp/bridge_be/be.cjs:44968` |
| `updateMarkup(t, e)` | markups | `X.update(Bt).set(e).where(se(Bt.id, t)).run();`<br>`recalcPricesFromRules()`<br>`return X.select().from(Bt).where(se(Bt.id, t)).get()` | `/tmp/bridge_be/be.cjs:44975` |
| `deleteMarkup(t)` | markups | `X.delete(Bt).where(se(Bt.id, t)).run();`<br>`recalcPricesFromRules()` | `/tmp/bridge_be/be.cjs:44982` |
| `listPromotions()` | promotions | `return X.select().from(hn).all()` | `/tmp/bridge_be/be.cjs:44988` |
| `addPromotion(t)` | promotions | `const r = X.insert(hn).values(t).returning().get();`<br>`recalcPricesFromRules()` | `/tmp/bridge_be/be.cjs:44991` |
| `updatePromotion(t, e)` | promotions | `X.update(hn).set(e).where(se(hn.id, t)).run();`<br>`recalcPricesFromRules()`<br>`return X.select().from(hn).where(se(hn.id, t)).get()` | `/tmp/bridge_be/be.cjs:44998` |
| `deletePromotion(t)` | promotions | `X.delete(hn).where(se(hn.id, t)).run();`<br>`recalcPricesFromRules()` | `/tmp/bridge_be/be.cjs:45005` |
| `listSuppliers()` | products, suppliers | `let t = X.select().from(Ot).orderBy(Ot.kod).all(),`<br>`return Qi.prepare(`WITH z AS (SELECT dostawca,kod,cena_zakupu,cena_sprzedazy,stan,zarejestrowano_at,LAG(cena_zakupu) OVER (PARTITION BY kod ORDER BY zarejestrowano_at) AS prev_cz,LAG(cena_sprzedazy) OVER (PARTITION BY kod ORDER B…`<br>`let r = X.select({` | `/tmp/bridge_be/be.cjs:45011` |
| `getSupplier(t)` | suppliers | `return X.select().from(Ot).where(se(Ot.id, t)).get()` | `/tmp/bridge_be/be.cjs:45037` |
| `getSupplierByKod(t)` | suppliers | `return X.select().from(Ot).where(se(Ot.kod, t)).get()` | `/tmp/bridge_be/be.cjs:45040` |
| `updateSupplier(t, e)` | suppliers | `return X.update(Ot).set(e).where(se(Ot.id, t)).run(), this.getSupplier(t)` | `/tmp/bridge_be/be.cjs:45043` |
| `listUsers()` | users | `return X.select().from(dt).all()` | `/tmp/bridge_be/be.cjs:45046` |
| `getUserById(t)` | users | `return X.select().from(dt).where(se(dt.id, t)).get()` | `/tmp/bridge_be/be.cjs:45049` |
| `getUserByEmail(t)` | users | `return X.select().from(dt).where(se(dt.email, t)).get()` | `/tmp/bridge_be/be.cjs:45052` |
| `addUser(t)` | users | `return X.insert(dt).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:45055` |
| `updateUserLogin(t)` | users | `X.update(dt).set({` | `/tmp/bridge_be/be.cjs:45058` |
| `updateUserPassword(t, e)` | users | `X.update(dt).set({` | `/tmp/bridge_be/be.cjs:45063` |
| `listAudit(t = 500)` | audit_log | `return X.select().from(Za).orderBy(Ii(Za.kiedy)).limit(t).all()` | `/tmp/bridge_be/be.cjs:45068` |
| `addAudit(t)` | audit_log | `return X.insert(Za).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:45071` |
| `listSpedycja()` | spedycja_limity | `return X.select().from(gn).all()` | `/tmp/bridge_be/be.cjs:45074` |
| `upsertSpedycja(t)` | spedycja_limity | `let e = X.select().from(gn).where(se(gn.dostawcaKod, t.dostawcaKod)).get();`<br>`e ? X.update(gn).set(t).where(se(gn.id, e.id)).run() : X.insert(gn).values(t).run()` | `/tmp/bridge_be/be.cjs:45077` |
| `getConfig(t)` | config | `return X.select().from(Jt).where(se(Jt.klucz, t)).get()?.wartosc` | `/tmp/bridge_be/be.cjs:45081` |
| `setConfig(t, e)` | config | `X.select().from(Jt).where(se(Jt.klucz, t)).get() ? X.update(Jt).set({`<br>`}).where(se(Jt.klucz, t)).run() : X.insert(Jt).values({` | `/tmp/bridge_be/be.cjs:45084` |
| `allConfig()` | config | `let t = X.select().from(Jt).all(),` | `/tmp/bridge_be/be.cjs:45092` |
| `addHistory(t)` | history | `return X.insert(Wa).values(t).returning().get()` | `/tmp/bridge_be/be.cjs:45098` |

### Znaczące zachowania

* `addProductsBulk` i `acceptStaging` przed zapisem uruchamiają wymiary, pamięć linku, `kod_importu`, pamięć nazwy i pamięć wagi (`/tmp/bridge_be/be.cjs:44786-44802`, `44897-44915`).
* `acceptStaging` dla `wycofana` ustawia produktowi `status='wstrzymany'` i `stan=0`, po czym usuwa staging (`/tmp/bridge_be/be.cjs:44831-44838`).
* `addStaging` deduplikuje po `kod`, `typ_zmiany` i `powod` przed insertem (`/tmp/bridge_be/be.cjs:44923-44926`).