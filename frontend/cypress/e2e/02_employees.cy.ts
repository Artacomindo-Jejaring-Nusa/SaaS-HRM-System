/// <reference types="cypress" />

describe("02. Employee & Directory Module", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display employees list page with table and filters", () => {
    cy.visit("/dashboard/employees");
    cy.url().should("include", "/dashboard/employees");
    cy.get("table, .grid, main", { timeout: 10000 }).should("be.visible");
    cy.get("input[placeholder*='Cari' i], input[type='search']").should("exist");
  });

  it("should display employee directory page", () => {
    cy.visit("/dashboard/directory");
    cy.url().should("include", "/dashboard/directory");
    cy.get("body").should("be.visible");
    cy.get("main").should("be.visible");
  });

  it("should display employee birthdays page", () => {
    cy.visit("/dashboard/birthdays");
    cy.url().should("include", "/dashboard/birthdays");
    cy.get("body").should("be.visible");
  });

  it("should display employee documents page", () => {
    cy.visit("/dashboard/documents");
    cy.url().should("include", "/dashboard/documents");
    cy.get("body").should("be.visible");
  });
});
