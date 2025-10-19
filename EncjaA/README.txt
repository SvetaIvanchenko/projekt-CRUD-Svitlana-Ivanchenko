README EncjaA Svitlana Ivanchenko

Jak uruchomić lokalnie:
1)	ze strony https://nodejs.org/ pobrać aplikację Node.js
2)	W cmd wpisać „node -v”, potem „npm -v” żeby sprawdzić czy poprawnie zainstalowano
3)	W cmd wpisać „npm init -y”, potem „npm install express better-sqlite3” aby pobrać package.json
4)	Przenieść pobrany z GitHub plik do folderu Users lub w ten folder, w który zainstalowano package.json
4)	Uruchomic plik poleceniem “node EncjaA_SI.js”

Opis treści + endpoint:
1)	Strona przeznaczona do publikacji opinii użytkowników o oberjzanych filmach lub serialach
2)	Użytkownik wypelnia pola Nazwa, Rok produkcji, Rodzaj, Typ, Ocena, Opinia
3) 	Tworzy się baza danych w której znajdują się podane dane
4)	Na stronie wyświetlają się podane dane
5)	Użytkownik może aktualizować i usuwać swój komentarz
6)	Dodano Endpoint 404 (strona nie istnieje) chociaż jednostronna aplikacja tego nie potrzebuje.


