/// <reference types="cypress" />

describe("04. Leaves, Permits & Overtime Module", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display leaves management and leave requests", () => {
    cy.visit("/dashboard/leaves");
    cy.url().should("include", "/dashboard/leaves");
    cy.get("main").should("be.visible");
  });

  it("should display employee leave balances", () => {
    cy.visit("/dashboard/leave-balances");
    cy.url().should("include", "/dashboard/leave-balances");
    cy.get("main").should("be.visible");
  });

  it("should display leave calendar and mass leaves", () => {
    cy.visit("/dashboard/leave-calendar");
    cy.url().should("include", "/dashboard/leave-calendar");
    cy.get("body").should("be.visible");

    cy.visit("/dashboard/mass-leaves");
    cy.url().should("include", "/dashboard/mass-leaves");
    cy.get("body").should("be.visible");
  });

  it("should display permits & sick leaves management", () => {
    cy.visit("/dashboard/permits");
    cy.url().should("include", "/dashboard/permits");
    cy.get("main").should("be.visible");
  });

  it("should display overtimes management", () => {
    cy.visit("/dashboard/overtimes");
    cy.url().should("include", "/dashboard/overtimes");
    cy.get("main").should("be.visible");
  });
});
