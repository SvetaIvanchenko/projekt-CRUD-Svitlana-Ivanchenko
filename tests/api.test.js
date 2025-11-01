// tests/api.test.js
// testy integracyjne: sprawdzamy kody błędów i logikę API

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, db } from "../app-instance.js";

// mały helper żeby wyczyścić bazę przed testami integracyjnymi
function resetDb() {
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM reviews").run();
}

// test 1: rejestracja z błędnymi danymi -> 422
test("POST /api/register z niepoprawnymi danymi zwraca 422", async () => {
    resetDb();

    const res = await request(app)
        .post("/api/register")
        .set("Content-Type", "application/json")
        .send({
            username: "ab",   // za krótki login
            password: "1"     // za krótkie hasło
        });

    assert.equal(res.statusCode, 422, "powinien być kod 422");
    assert.equal(res.body.status, 422);
    assert.equal(res.body.error, "Unprocessable Entity");
    assert.ok(Array.isArray(res.body.fieldErrors));
});

// test 2: duplikat użytkownika -> 409 Conflict
test("POST /api/register duplikat zwraca 409", async () => {
    resetDb();

    // pierwsza rejestracja OK
    const first = await request(app)
        .post("/api/register")
        .set("Content-Type", "application/json")
        .send({
            username: "Kerrigan",
            password: "qwerty"
        });

    assert.equal(first.statusCode, 200, "pierwsze tworzenie konta powinno przejść");

    // druga próba z tym samym loginem
    const dup = await request(app)
        .post("/api/register")
        .set("Content-Type", "application/json")
        .send({
            username: "Kerrigan",
            password: "qwerty"
        });

    assert.equal(dup.statusCode, 409, "powinien być 409 Conflict przy duplikacie");
    assert.equal(dup.body.status, 409);
    assert.equal(dup.body.error, "Conflict");
});

// test 3: usuwanie nieistniejącej recenzji -> 404 Not Found
test("DELETE /api/reviews/:id nieistniejącego zasobu zwraca 404", async () => {
    resetDb();

    const res = await request(app)
        .delete("/api/reviews/999999"); // zakładamy że nie ma takiej recenzji

    assert.equal(res.statusCode, 404, "powinien być 404 jeśli recenzja nie istnieje");
    assert.equal(res.body.status, 404);
    assert.equal(res.body.error, "Not Found");
});

// test 4: dodanie recenzji bez sesji -> 401 Unauthorized
test("POST /api/reviews bez zalogowania zwraca 401", async () => {
    resetDb();

    const res = await request(app)
        .post("/api/reviews")
        .set("Content-Type", "application/json")
        .send({
            title: "Matrix",
            kind: "Film",
            rating: 9.5
        });

    assert.equal(res.statusCode, 401, "powinien być 401 gdy brak sesji");
    assert.equal(res.body.status, 401);
    assert.equal(res.body.error, "Unauthorized");
});
