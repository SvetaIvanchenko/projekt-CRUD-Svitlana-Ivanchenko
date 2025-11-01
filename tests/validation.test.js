import { strict as assert } from "node:assert";
import {
    validateUserCredentials,
    validateReviewPayload
} from "../app-instance.js";

describe("validateUserCredentials", () => {
    it("rejects short username", () => {
        const errs = validateUserCredentials({ username: "ab", password: "abcd" });
        assert.ok(errs.find(e => e.field === "username"), "username should error");
    });

    it("rejects short password", () => {
        const errs = validateUserCredentials({ username: "user123", password: "a" });
        assert.ok(errs.find(e => e.field === "password"), "password should error");
    });

    it("accepts valid creds", () => {
        const errs = validateUserCredentials({ username: "user123", password: "abcd" });
        assert.equal(errs.length, 0);
    });
});

describe("validateReviewPayload", () => {
    it("requires title/kind/rating", () => {
        const errs = validateReviewPayload({ title: "", kind: "", rating: null });
        assert.ok(errs.find(e => e.field === "title"));
        assert.ok(errs.find(e => e.field === "kind"));
        assert.ok(errs.find(e => e.field === "rating"));
    });

    it("rejects rating > 10", () => {
        const errs = validateReviewPayload({
            title: "Matrix",
            kind: "Film",
            rating: 900
        });
        assert.ok(errs.find(e => e.field === "rating"));
    });

    it("accepts proper review", () => {
        const errs = validateReviewPayload({
            title: "Matrix",
            kind: "Film",
            rating: 9.5
        });
        assert.equal(errs.length, 0);
    });
});
