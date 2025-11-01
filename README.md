# Projekt zespołowy — Web aplikacja CRUD

**Autor:**  
Svitlana Ivanchenko

**Partner:**  
Dziyana Parakhonka 
 
**Film Reviews — wersja z autoryzacją (zadanie 2–3)**

## Opis projektu

Projekt webowy w **Node.js + Express + SQLite**.

Aplikacja umożliwia **rejestrację użytkowników, logowanie oraz zarządzanie recenzjami filmów i seriali**.  
Hasła są zapisywane jako **hash**, a dostęp do zasobów CRUD jest możliwy tylko po zalogowaniu.

---

##  Wykonane funkcjonalności

###  Część 1 — Podstawowy CRUD
 
- Model `Review`: `id`, `title`, `category`, `rating`, `content`
- Rozszerzenie tabeli `reviews` o kolumny **`username`** oraz **`review_date`** poprzez partnerkę
- Dostosowanie widoków i formularzy do nowych pól  
- Ulepszony frontend (dodatkowe pola przy tworzeniu recenzji)

###  Część 2 — Autotyzacja i logowanie
  
- Model `User`: `id`, `login` (unikalny), `hasło` (hash), `rola`, `data utworzenia` 
- Rejestracja: sprawdzenie unikalności loginu, zapis hasha w bazie  
- Logowanie: zwraca cookie HTTP-only (ochrona sesji)  
- Publiczna strona `/home` dostępna bez logowania  
- CRUD recenzji działa w pełni (`GET`, `POST`, `PUT`, `DELETE`)  
- Walidacja danych: wymagane pola, poprawne typy, kody błędów `400 / 401 / 403 / 404`  

###  Część 3 — Refaktoryzacja i automatyzacja (CI/CD)

W trzecim etapie projektu wprowadzono:
- Oddzielenie konfiguracji aplikacji od pliku uruchomieniowego (`app-instance.js` + `server.js`)
- Dodanie endpointu **`/health`** wykorzystywanego w testach Smoke Test (CI/CD)
- Automatyczne testy jednostkowe i integracyjne uruchamiane przez GitHub Actions
- Pipeline CI/CD (build, test, deploy → Render)
- Walidacja i obsługa błędów zgodna z zasadami REST (`400 / 401 / 403 / 404 / 409 / 422`)

---

##  Demo

**Adres aplikacji:**  
https://filmopinie.onrender.com

**Konto testowe:**  
Login: `Kerrigan`  
Hasło: `Kerrigan`

---

##  Używane technologie

- **Node.js**
- **Express.js**
- **SQLite**
- **express-session**
- **bcrypt**
- **GitHub Actions (CI/CD)**
- **Render (hosting)**

---

## ⚠️ Uwaga — trwałość danych

Aplikacja działa na darmowym planie **Render Free Tier**, który:
- usypia instancję po okresie nieaktywności,  
- czyści lokalną bazę danych (SQLite) po ponownym uruchomieniu.

Dlatego **nowo dodane dane (użytkownicy i recenzje)** są przechowywane tylko tymczasowo.  
Nie jest to błąd aplikacji, lecz ograniczenie środowiska hostingowego.
