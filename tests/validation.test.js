// tests/validation.test.js
// testy jednostkowe: walidacja danych
// Używa wbudowanego runnera Node.js (node:test)

import test from "node:test";
import assert from "node:assert/strict";
import {
    validateUserCredentials,
    validateReviewPayload
} from "../app-instance.js";

test("validateUserCredentials: odrzuca za krótki login", () => {
    const errs = validateUserCredentials({ username: "ab", password: "abcd" });
    const hasUsernameError = errs.some(e => e.field === "username");
    assert.equal(hasUsernameError, true, "powinien zgłosić błąd username");
});

test("validateUserCredentials: odrzuca za krótkie hasło", () => {
    const errs = validateUserCredentials({ username: "user123", password: "x" });
    const hasPwdError = errs.some(e => e.field === "password");
    assert.equal(hasPwdError, true, "powinien zgłosić błąd password");
});

test("validateUserCredentials: akceptuje poprawne dane", () => {
    const errs = validateUserCredentials({ username: "user123", password: "abcd" });
    assert.equal(errs.length, 0, "dla poprawnych danych nie powinno być błędów");
});

test("validateReviewPayload: wymaga tytułu/kategorii/oceny", () => {
    const errs = validateReviewPayload({
        title: "",
        year: "",
        genre: "",
        kind: "",
        rating: null,
        review: ""
    });

    assert.equal(
        errs.some(e => e.field === "title"),
        true,
        "powinien zgłosić brak tytułu"
    );
    assert.equal(
        errs.some(e => e.field === "kind"),
        true,
        "powinien zgłosić brak typu (Film/Serial/Anime)"
    );
    assert.equal(
        errs.some(e => e.field === "rating"),
        true,
        "powinien zgłosić brak oceny"
    );
});

test("validateReviewPayload: odrzuca ocenę > 10", () => {
    const errs = validateReviewPayload({
        title: "Matrix",
        year: "1999",
        genre: "Sci-Fi",
        kind: "Film",
        rating: 999,
        review: "super"
    });

    assert.equal(
        errs.some(e => e.field === "rating"),
        true,
        "powinien zgłosić że rating poza zakresem"
    );
});

test("validateReviewPayload: akceptuje poprawną recenzję", () => {
    const errs = validateReviewPayload({
        title: "Matrix",
        year: "1999",
        genre: "Sci-Fi",
        kind: "Film",
        rating: 9.5,
        review: "rewelacja"
    });

    assert.equal(
        errs.length,
        0,
        "dla poprawnych danych nie powinno być błędów"
    );
});
