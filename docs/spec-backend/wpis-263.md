# Wpis 263 — powiadomienia e-mail o błędach zamówień partnerów

`src/poczta/nadawca.ts` (SMTP, `nodemailer`) + `src/partnerzy/powiadomienia.ts`: przebieg co kilka minut wysyła wiadomość o każdym zamówieniu w `blad_importu` (raz, tabela `partner_powiadomienia`, migracja 038) i natychmiast o nieudanym „Utwórz w Selly” (502). Wyłączone bez `SMTP_HOST/USER/HASLO/OD` i `POWIADOMIENIA_PARTNERZY_DO`. `POST /api/partnerzy/powiadomienia/test` — wiadomość próbna. Szczegóły: `docs/tickets/263-FEATURE-partnerzy-powiadomienia-email/plan.md`.
