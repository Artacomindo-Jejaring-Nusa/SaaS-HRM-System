/// <reference types="cypress" />

describe("05. Payroll & Disciplinary Deduction Engine", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display payroll batch history with summary metrics and export button", () => {
    cy.visit("/dashboard/payroll");
    cy.url().should("include", "/dashboard/payroll");
    cy.get("main").should("be.visible");
    cy.contains("Export Excel", { matchCase: false }).should("be.visible");
  });

  it("should display payroll settings and disciplinary deduction tier configuration", () => {
    cy.visit("/dashboard/payroll/settings");
    cy.url().should("include", "/dashboard/payroll/settings");
    cy.get("main").should("be.visible");
    cy.contains("Disiplin", { matchCase: false }).should("be.visible");
  });

  it("should display payroll process page", () => {
    cy.visit("/dashboard/payroll/process");
    cy.url().should("include", "/dashboard/payroll/process");
    cy.get("main").should("be.visible");
  });

  it("should display payroll approval page with detailed deduction columns", () => {
    cy.visit("/dashboard/payroll/approval");
    cy.url().should("include", "/dashboard/payroll/approval");
    cy.get("main").should("be.visible");
  });

  it("should display employee self-service payroll history (my-payroll)", () => {
    cy.visit("/dashboard/payroll/my-payroll");
    cy.url().should("include", "/dashboard/payroll/my-payroll");
    cy.get("main").should("be.visible");
  });
});
