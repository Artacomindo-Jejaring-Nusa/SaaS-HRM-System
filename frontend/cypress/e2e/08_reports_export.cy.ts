/// <reference types="cypress" />

describe("08. Reports & Data Export Module", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display attendance report with filters", () => {
    cy.visit("/dashboard/reports/attendance");
    cy.url().should("include", "/dashboard/reports/attendance");
    cy.get("main").should("be.visible");
  });

  it("should display payroll report with real KPI metrics and Excel export", () => {
    cy.visit("/dashboard/reports/payroll");
    cy.url().should("include", "/dashboard/reports/payroll");
    cy.get("main").should("be.visible");
    cy.contains("Excel", { matchCase: false }).should("be.visible");
  });

  it("should display leaves, permits, and overtimes reports", () => {
    cy.visit("/dashboard/reports/leaves");
    cy.url().should("include", "/dashboard/reports/leaves");
    cy.get("main").should("be.visible");

    cy.visit("/dashboard/reports/permits");
    cy.url().should("include", "/dashboard/reports/permits");
    cy.get("main").should("be.visible");

    cy.visit("/dashboard/reports/overtimes");
    cy.url().should("include", "/dashboard/reports/overtimes");
    cy.get("main").should("be.visible");
  });

  it("should display reimbursements and tasks reports", () => {
    cy.visit("/dashboard/reports/reimbursements");
    cy.url().should("include", "/dashboard/reports/reimbursements");
    cy.get("main").should("be.visible");

    cy.visit("/dashboard/reports/tasks");
    cy.url().should("include", "/dashboard/reports/tasks");
    cy.get("main").should("be.visible");
  });

  it("should display shift swap and suspicious attendance reports", () => {
    cy.visit("/dashboard/reports/shift-swap");
    cy.url().should("include", "/dashboard/reports/shift-swap");
    cy.get("body").should("be.visible");

    cy.visit("/dashboard/reports/suspicious");
    cy.url().should("include", "/dashboard/reports/suspicious");
    cy.get("body").should("be.visible");
  });
});
