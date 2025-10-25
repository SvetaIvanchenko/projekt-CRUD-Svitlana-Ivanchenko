Projekt zespolowy - web aplikacja CRUD

Svitlana Ivanchenko



Film Reviews — wersja z autoryzacją (zadanie 2)



Projekt webowy w Node.js + Express + SQLite.

Umożliwia rejestrację, logowanie i zarządzanie recenzjami filmów oraz seriali.

Hasła są zapisywane jako hash, dostęp do danych wymaga zalogowania.



Wykonane funkcjonalności:



Model User: id, login (unikalny), hasło (hash), rola, data utworzenia



Rejestracja: sprawdzenie unikalności loginu, zapis hasha



Logowanie: zwraca token lub cookie (HTTP-only)



Ochrona zasobów: CRUD dostępny tylko po zalogowaniu (401/403 przy braku dostępu)



Publiczna strona /home dostępna bez logowania



CRUD recenzji działa w pełni (GET, POST, PUT, DELETE)



Walidacja danych: wymagane pola, poprawne typy, kody błędów 400/404



demo konto: Kerrigan Kerrigan 

Adres: https://filmopinie.onrender.com


