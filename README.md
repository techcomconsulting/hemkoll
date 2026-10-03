# Hemkoll

Kvitton, garantier, påminnelser och budget. På ett ställe.

- **Mitt** – din egen flik. Bara du ser den.
- **Gemensamma flikar** – t.ex. "Hushållet". Alla som är med ser samma pärm och budget.

## Så får du igång appen

1. **Firebase:** skapa projekt, slå på *Authentication → E-post/lösenord* och skapa *Firestore* (eur3, produktionsläge).
2. **Regler:** öppna filen `firestore.rules`, kopiera allt och klistra in under *Firestore → Regler*. Klicka **Publicera**.
3. **Koppling:** Firebase-uppgifterna ligger i `js/config.js`.
4. **GitHub Pages:** *Settings → Pages → Branch: main, / (root) → Save*.
5. **Tillåt adressen:** *Authentication → Inställningar → Auktoriserade domäner → lägg till* `techcomconsulting.github.io`.

Adressen blir: `https://techcomconsulting.github.io/hemkoll/`

## Tidslinjen (husets historia)

- Lägg in renoveringar, nya köp och service. Med bilder, länk till manual och kvitton från pärmen.
- **Säljer du huset?** Tryck *Dela med ny ägare*. Köparen får en länk och kan spara allt i sin egen Hemkoll.
- **Viktigt:** efter den här uppdateringen måste reglerna i `firestore.rules` klistras in i Firebase igen (se steg 2).

## Bra att veta

- **Gratis.** Bilder sparas förminskade i databasen, så inget kort behövs.
- **Ny version?** Ändra versionen (t.ex. `hemkoll-v3` till `hemkoll-v4`) i `sw.js`.
