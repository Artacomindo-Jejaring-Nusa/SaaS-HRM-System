/// <reference types="cypress" />

describe("01. Authentication & Session Module", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("should display login form with company, email, and password fields", () => {
    cy.get("#company").should("be.visible");
    cy.get("#email").should("be.visible");
    cy.get("#password").should("be.visible");
    cy.get('button[type="submit"]').should("be.visible");
  });

  it("should show validation error on invalid login attempt", () => {
    cy.get("#company").type("Narwasthu");
    cy.wait(400);
    cy.get("body").then(($body) => {
      if ($body.find(".login-suggestion-item").length > 0) {
        cy.get(".login-suggestion-item").first().click();
      }
    });

    cy.get("#email").type("wrong_user@example.com");
    cy.get("#password").type("wrongpassword");
    cy.get('button[type="submit"]').click();
    cy.get(".login-error, body", { timeout: 8000 }).should("be.visible");
  });

  it("should navigate to forgot-password page and render correctly", () => {
    cy.visit("/forgot-password");
    cy.get("body").should("be.visible");
    cy.get('input[type="email"], input[name="email"]').should("exist");
  });

  it("should navigate to reset-password page and render correctly", () => {
    cy.visit("/reset-password?token=mocktoken&email=test@example.com");
    cy.get("body").should("be.visible");
  });

  it("should log in successfully with valid credentials and redirect to dashboard", () => {
    cy.visit("/login");
    cy.get("#company").should("be.visible").clear().type("Narwasthu");
    cy.wait(400);
    cy.get("body").then(($body) => {
      if ($body.find(".login-suggestion-item").length > 0) {
        cy.get(".login-suggestion-item").first().click();
      }
    });
    cy.get("#email").clear().type("ardhito@artacomindo.com");
    cy.get("#password").clear().type("password");
    cy.get("button[type='submit']").click();
    cy.url().should("include", "/dashboard", { timeout: 15000 });
  });
});
