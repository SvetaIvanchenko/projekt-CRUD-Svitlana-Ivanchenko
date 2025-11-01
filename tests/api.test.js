import request from "supertest";
import { strict as assert } from "node:assert";
import { app, db } from "../app-instance.js";

describe("API integration", () => {

    // przed testami czyścimy bazę userów żeby nie było konfliktu
    before(() => {
        db.prepare("DELETE FROM users").run();
        db.prepare("DELETE FROM reviews").run();
    });

    it("POST /api/register z błędnym payloadem -> 422", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ username: "ab", password: "1" }) // za krótkie
            .set("Content-Type", "application/json");

        assert.equal(res.statusCode, 422);
        assert.equal(res.body.status, 422);
        assert.equal(res.body.error, "Unprocessable Entity");
    });

    it("POST /api/register z duplikatem -> 409", async () => {
        // pierwszy raz OK
        const okRes = await request(app)
            .post("/api/register")
            .send({ username: "Kerrigan", password: "qwerty" })
            .set("Content-Type", "application/json");

        assert.equal(okRes.statusCode, 200);

        // drugi raz ten sam login -> 409 Conflict
        const dupRes = await request(app)
            .post("/api/register")
            .send({ username: "Kerrigan", password: "qwerty" })
            .set("Content-Type", "application/json");

        assert.equal(dupRes.statusCode, 409);
        assert.equal(dupRes.body.status, 409);
        assert.equal(dupRes.body.error, "Conflict");
    });

    it("DELETE /api/reviews/:id nieistniejącego zasobu -> 404", async () => {
        const res = await request(app)
            .delete("/api/reviews/999999"); // coś co raczej nie istnieje

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.status, 404);
        assert.equal(res.body.error, "Not Found");
    });

    it("POST /api/reviews bez sesji -> 401/Unauthorized", async () => {
        const res = await request(app)
            .post("/api/reviews")
            .send({
                title: "Matrix",
                kind: "Film",
                rating: 9.5
            })
            .set("Content-Type", "application/json");

        assert.equal(res.statusCode, 401); // brak sesji -> 401
        assert.equal(res.body.status, 401);
        assert.equal(res.body.error, "Unauthorized");
    });
});
