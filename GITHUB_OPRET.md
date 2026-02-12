# Opret nyt GitHub-projekt og push

Projektet er nu et git-repository med en initial commit. Sådan lægger du det op på GitHub:

## 1. Opret et nyt repository på GitHub

1. Gå til [github.com/new](https://github.com/new).
2. Vælg fx **shelterdk** som repository-navn (eller et andet navn).
3. Vælg **Private** eller **Public**.
4. **Lad være med** at tilføje README, .gitignore eller license – de findes allerede lokalt.
5. Klik **Create repository**.

## 2. Kobl til GitHub og push

I terminalen, fra mappen `shelterdk`:

```bash
# Erstat YOUR_USERNAME og YOUR_REPO med dit GitHub-brugernavn og repo-navn
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Eksempel hvis dit brugernavn er `kaad` og repo hedder `shelterdk`:

```bash
git remote add origin https://github.com/kaad/shelterdk.git
git branch -M main
git push -u origin main
```

## 3. (Valgfrit) Sæt din git-identitet

Den nuværende commit er lavet med placeholder-identitet. For at bruge din egen navn og e-mail i fremtidige commits:

```bash
git config user.name "Dit Navn"
git config user.email "din@email.dk"
```

---

**Bemærk:** Filer som `.env` og `web/.env.local` er **ikke** med i repo (de er i `.gitignore`). Når andre kloner projektet, skal de oprette egne `.env` ud fra `.env.example` og `web/.env.example`.
